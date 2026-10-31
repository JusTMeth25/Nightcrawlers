import { t } from '../../i18n/it'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUsername(s: string): string | null {
  return USERNAME_RE.test(s) ? null : t('validation.username')
}

export function validateEmail(s: string): string | null {
  return s.length <= 254 && EMAIL_RE.test(s) ? null : t('validation.email')
}

/** Length and username checks; the common-password list stays on the server (400 on the field). */
export function validatePassword(p: string, username: string): string | null {
  if (p.length < 12 || p.length > 128) return t('validation.passwordLength')
  if (username && p.toLowerCase().includes(username.toLowerCase())) return t('validation.passwordUsername')
  return null
}

export function required(s: string): string | null {
  return s.trim() ? null : t('form.required')
}
