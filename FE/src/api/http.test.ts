import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, CSRF_HEADER, type AuthResponse } from '@shared/api-contract'
import { createRealApi } from './ApiClient'
import { createAuthBridge } from './auth'
import { ApiError } from './errors'
import { createHttp } from './http'

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function problem(status: number, title: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })
}

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(handler: Handler, refreshImpl?: () => Promise<string | null>) {
  let token: string | null = 'old'
  const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve().then(() => handler(String(input), init ?? {})),
  )
  const refresh = vi.fn(
    refreshImpl ??
      (async () => {
        await tick()
        token = 'new'
        return token
      }),
  )
  const onAuthLost = vi.fn(() => {
    token = null
  })
  const http = createHttp({ getToken: () => token, refresh, onAuthLost, fetchImpl: fetchImpl as typeof fetch })
  return { http, fetchImpl, refresh, onAuthLost }
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('http', () => {
  it('sends the bearer token, same-origin credentials and JSON body', async () => {
    const { http, fetchImpl } = setup(() => json(200, { ok: true }))
    await http.request('/api/x', { method: 'POST', body: { a: 1 }, auth: true })
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('same-origin')
    expect(header(init, 'Authorization')).toBe('Bearer old')
    expect(header(init, 'Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('keeps the errorId of a 500 problem detail', async () => {
    const { http } = setup(() =>
      new Response(JSON.stringify({ type: 'about:blank', title: 'Errore interno', status: 500, errorId: 'e-42' }), {
        status: 500,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
    await expect(http.request('/api/x', { auth: true })).rejects.toMatchObject({
      status: 500,
      problem: { errorId: 'e-42' },
    })
  })

  it('refreshes once for three parallel 401s and retries each request once', async () => {
    const { http, refresh, fetchImpl, onAuthLost } = setup((url, init) =>
      header(init, 'Authorization') === 'Bearer new' ? json(200, { url }) : problem(401, 'Unauthorized'),
    )
    const results = await Promise.all([
      http.request<{ url: string }>('/api/a', { auth: true }),
      http.request<{ url: string }>('/api/b', { auth: true }),
      http.request<{ url: string }>('/api/c', { auth: true }),
    ])
    expect(results.map((r) => r.url)).toEqual(['/api/a', '/api/b', '/api/c'])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(onAuthLost).not.toHaveBeenCalled()
  })

  it('refreshes once even when a 401 arrives after the refresh already finished', async () => {
    let releaseSlow: () => void = () => {}
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })
    const { http, refresh } = setup(async (url, init) => {
      if (url === '/api/slow' && header(init, 'Authorization') === 'Bearer old') await slowGate
      return header(init, 'Authorization') === 'Bearer new' ? json(200, { url }) : problem(401, 'Unauthorized')
    })
    const slow = http.request<{ url: string }>('/api/slow', { auth: true })
    await expect(http.request<{ url: string }>('/api/fast', { auth: true })).resolves.toEqual({ url: '/api/fast' })
    releaseSlow()
    await expect(slow).resolves.toEqual({ url: '/api/slow' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('calls onAuthLost once and does not loop when the refresh fails', async () => {
    const { http, refresh, fetchImpl, onAuthLost } = setup(
      () => problem(401, 'Unauthorized'),
      async () => {
        await tick()
        return null
      },
    )
    const results = await Promise.allSettled([
      http.request('/api/a', { auth: true }),
      http.request('/api/b', { auth: true }),
      http.request('/api/c', { auth: true }),
    ])
    for (const r of results) {
      expect(r.status).toBe('rejected')
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ApiError)
      expect(((r as PromiseRejectedResult).reason as ApiError).status).toBe(401)
    }
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onAuthLost).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['network error', new ApiError(0, null, null)],
    ['rate limit', new ApiError(429, null, 30)],
    ['server error', new ApiError(503, null, null)],
  ])('a refresh failing with %s propagates the error and keeps the session', async (_name, refreshError) => {
    const { http, refresh, onAuthLost } = setup(
      () => problem(401, 'Unauthorized'),
      async () => {
        await tick()
        throw refreshError
      },
    )
    const results = await Promise.allSettled([http.request('/api/a', { auth: true }), http.request('/api/b', { auth: true })])
    for (const r of results) {
      expect(r.status).toBe('rejected')
      expect((r as PromiseRejectedResult).reason).toBe(refreshError)
    }
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onAuthLost).not.toHaveBeenCalled()
  })

  it.each([401, 403])('a refresh rejected with %i ends the session', async (status) => {
    const { http, onAuthLost } = setup(
      () => problem(401, 'Unauthorized'),
      async () => {
        throw new ApiError(status, null, null)
      },
    )
    await expect(http.request('/api/a', { auth: true })).rejects.toMatchObject({ status: 401 })
    expect(onAuthLost).toHaveBeenCalledTimes(1)
  })

  it('after the session is lost, a call without token does not refresh again', async () => {
    const { http, refresh, onAuthLost } = setup(
      () => problem(401, 'Unauthorized'),
      async () => null,
    )
    await expect(http.request('/api/a', { auth: true })).rejects.toMatchObject({ status: 401 })
    await expect(http.request('/api/b', { auth: true })).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onAuthLost).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on 401 of an unauthenticated call (e.g. wrong login)', async () => {
    const { http, refresh } = setup(() => problem(401, 'Bad credentials'))
    await expect(http.request('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not retry twice when the retried request is 401 again', async () => {
    const { http, refresh, fetchImpl } = setup(() => problem(401, 'Unauthorized'))
    await expect(http.request('/api/a', { auth: true })).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('sends the CSRF header from the XSRF-TOKEN cookie when asked', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    const { http, fetchImpl } = setup(() => json(200, {}))
    await http.request('/api/auth/refresh', { method: 'POST', csrf: true })
    expect(header(fetchImpl.mock.calls[0][1] as RequestInit, CSRF_HEADER)).toBe('csrf-123')
  })

  it('maps problem+json errors to ApiError with the problem', async () => {
    const { http } = setup(() => problem(409, 'Not enough eurodollars'))
    const error = await http.request('/api/x', { method: 'POST' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).problem?.title).toBe('Not enough eurodollars')
  })

  it('reads Retry-After in seconds', async () => {
    const { http } = setup(() => problem(429, 'Too many requests', { 'Retry-After': '30' }))
    const error = (await http.request('/api/x').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(429)
    expect(error.retryAfterSec).toBe(30)
  })

  it('maps a rejected fetch to ApiError status 0', async () => {
    const { http } = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    const error = (await http.request('/api/x').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })

  it('returns undefined on 204', async () => {
    const { http } = setup(() => new Response(null, { status: 204 }))
    await expect(http.request('/api/x', { method: 'POST' })).resolves.toBeUndefined()
  })
})

describe('real ApiClient', () => {
  const user = { id: 'u1', username: 'demo', email: 'd@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z' }
  const auth: AuthResponse = { accessToken: 'tok-2', expiresInSec: 900, user }

  it('sends CSRF on refresh and logout and stores the refreshed token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-abc; path=/'
    const calls: { url: string; init: RequestInit }[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return String(input) === API.refresh ? json(200, auth) : new Response(null, { status: 204 })
    })
    const bridge = createAuthBridge()
    const api = createRealApi({ auth: bridge, fetchImpl: fetchImpl as typeof fetch })
    await api.refresh()
    expect(bridge.getToken()).toBe('tok-2')
    await api.logout()
    expect(calls.map((c) => c.url)).toEqual([API.refresh, API.logout])
    for (const c of calls) expect(header(c.init, CSRF_HEADER)).toBe('csrf-abc')
  })

  it('refreshes through the cookie when a bearer call gets 401, then retries', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-abc; path=/'
    const bridge = createAuthBridge()
    bridge.setToken('expired')
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === API.refresh) return json(200, auth)
      return header(init ?? {}, 'Authorization') === 'Bearer tok-2' ? json(200, user) : problem(401, 'Expired')
    })
    const api = createRealApi({ auth: bridge, fetchImpl: fetchImpl as typeof fetch })
    await expect(api.me()).resolves.toEqual(user)
    expect(bridge.getToken()).toBe('tok-2')
  })

  it('keeps the token when /auth/refresh answers 500', async () => {
    const bridge = createAuthBridge()
    bridge.setToken('expired')
    const lost = vi.fn()
    bridge.onAuthLost(lost)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === API.refresh ? problem(500, 'Boom') : problem(401, 'Expired'),
    )
    const api = createRealApi({ auth: bridge, fetchImpl: fetchImpl as typeof fetch })
    await expect(api.getSave()).rejects.toMatchObject({ status: 500 })
    expect(lost).not.toHaveBeenCalled()
    expect(bridge.getToken()).toBe('expired')
  })

  it('signals auth lost when the refresh is rejected', async () => {
    const bridge = createAuthBridge()
    bridge.setToken('expired')
    const lost = vi.fn()
    bridge.onAuthLost(lost)
    const fetchImpl = vi.fn(async () => problem(401, 'Expired'))
    const api = createRealApi({ auth: bridge, fetchImpl: fetchImpl as typeof fetch })
    await expect(api.getSave()).rejects.toMatchObject({ status: 401 })
    expect(lost).toHaveBeenCalledTimes(1)
    expect(bridge.getToken()).toBeNull()
  })
  it('DELETE /me with a wrong password (403) never refreshes and keeps the session', async () => {
    const bridge = createAuthBridge()
    bridge.setToken('valid')
    const lost = vi.fn()
    bridge.onAuthLost(lost)
    const urls: string[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(`${init?.method ?? 'GET'} ${String(input)}`)
      return problem(403, 'Password errata')
    })
    const api = createRealApi({ auth: bridge, fetchImpl: fetchImpl as typeof fetch })
    await expect(api.deleteAccount({ password: 'wrong-password-1' })).rejects.toMatchObject({ status: 403 })
    expect(urls).toEqual([`DELETE ${API.me}`])
    expect(lost).not.toHaveBeenCalled()
    expect(bridge.getToken()).toBe('valid')
  })
})
