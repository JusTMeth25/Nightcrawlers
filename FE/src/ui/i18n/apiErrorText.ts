import { isApiError } from '../../api/errors'
import { t } from './it'

/** Generic user-facing text for an API failure (network, rate limit, anything else). */
export function apiErrorText(error: unknown): string {
  if (!isApiError(error)) return t('error.generic')
  if (error.status === 0) return t('error.network')
  if (error.status === 429) {
    return error.retryAfterSec !== null
      ? t('error.rateLimited', { seconds: error.retryAfterSec })
      : t('error.rateLimitedShort')
  }
  return t('error.generic')
}

/** Field errors sent by the server in ProblemDetail.errors. */
export function fieldErrors(error: unknown): Record<string, string> {
  return isApiError(error) && error.problem?.errors ? error.problem.errors : {}
}
