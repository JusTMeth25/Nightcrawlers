import { CSRF_COOKIE } from '@shared/api-contract'

export function readCookie(name: string, cookies: string = typeof document === 'undefined' ? '' : document.cookie) {
  for (const part of cookies.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim()
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
  return null
}

/** Double-submit CSRF token: the XSRF-TOKEN cookie (readable by JS) echoed in X-CSRF-Token. */
export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE) || null
}
