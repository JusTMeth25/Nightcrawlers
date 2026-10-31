import { CSRF_HEADER, type ProblemDetail } from '@shared/api-contract'
import { readCsrfToken } from './csrf'
import { ApiError } from './errors'

export interface HttpOptions {
  getToken(): string | null
  /** Obtain a new access token through the refresh cookie; null (or a throw) = session lost. */
  refresh(): Promise<string | null>
  onAuthLost(): void
  fetchImpl?: typeof fetch
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  /** Send the Bearer token; a 401 triggers one shared refresh and one retry. */
  auth?: boolean
  /** Send X-CSRF-Token from the XSRF-TOKEN cookie (refresh and logout only). */
  csrf?: boolean
  responseType?: 'json' | 'blob'
}

export interface Http {
  request<T = void>(path: string, options?: RequestOptions): Promise<T>
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return null
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: ProblemDetail | null = null
  const type = res.headers.get('Content-Type') ?? ''
  if (type.includes('json')) {
    try {
      const body = (await res.json()) as Partial<ProblemDetail> | null
      if (body && typeof body === 'object' && typeof body.title === 'string') {
        problem = { type: body.type ?? 'about:blank', status: body.status ?? res.status, ...body } as ProblemDetail
      }
    } catch {
      problem = null
    }
  }
  return new ApiError(res.status, problem, parseRetryAfter(res.headers.get('Retry-After')))
}

export function createHttp(opts: HttpOptions): Http {
  const fetchImpl: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init))
  let refreshing: Promise<string | null> | null = null
  // token whose refresh already failed: later 401s carrying it must not refresh again (no loop)
  let lostToken: string | null | undefined = undefined

  function sharedRefresh(staleToken: string | null): Promise<string | null> {
    if (!refreshing) {
      refreshing = (async () => {
        let next: string | null
        try {
          next = await opts.refresh()
        } catch {
          next = null
        }
        if (!next) {
          lostToken = staleToken
          opts.onAuthLost()
        } else {
          lostToken = undefined
        }
        return next
      })().finally(() => {
        refreshing = null
      })
    }
    return refreshing
  }

  async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const headers = new Headers({ Accept: 'application/json, application/problem+json' })
    let body: string | undefined
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
    if (options.auth && token) headers.set('Authorization', `Bearer ${token}`)
    if (options.csrf) {
      const csrf = readCsrfToken()
      if (csrf) headers.set(CSRF_HEADER, csrf)
    }
    try {
      return await fetchImpl(path, {
        method: options.method ?? 'GET',
        headers,
        body,
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new ApiError(0, null, null, error instanceof Error ? error.message : 'Network error')
    }
  }

  async function newTokenAfter401(usedToken: string | null): Promise<string | null> {
    const current = opts.getToken()
    // another request already refreshed while this one was in flight
    if (current && current !== usedToken) return current
    if (refreshing) return refreshing
    if (lostToken !== undefined && lostToken === usedToken) return null
    return sharedRefresh(usedToken)
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const usedToken = options.auth ? opts.getToken() : null
    let res = await send(path, options, usedToken)
    if (res.status === 401 && options.auth) {
      const next = await newTokenAfter401(usedToken)
      if (next) res = await send(path, options, next)
    }
    if (!res.ok) throw await toApiError(res)
    if (options.responseType === 'blob') return (await res.blob()) as T
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  return { request }
}
