import type { ProblemDetail } from '@shared/api-contract'

/** Every failure of the API client. status 0 = network error (no response). */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetail | null
  readonly retryAfterSec: number | null

  constructor(status: number, problem: ProblemDetail | null, retryAfterSec: number | null, message?: string) {
    super(message ?? problem?.title ?? (status === 0 ? 'Network error' : `HTTP ${status}`))
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.retryAfterSec = retryAfterSec
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status)
}

export function problemError(status: number, title: string, errors?: Record<string, string>, retryAfterSec?: number) {
  const problem: ProblemDetail = { type: 'about:blank', title, status, ...(errors ? { errors } : {}) }
  return new ApiError(status, problem, retryAfterSec ?? null)
}
