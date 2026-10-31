import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/it'
import { validateEmail, validatePassword, validateUsername } from './validation'

describe('auth validation', () => {
  it('validateUsername follows ^[a-zA-Z0-9_]{3,20}$', () => {
    expect(validateUsername('neo_2077')).toBeNull()
    expect(validateUsername('ab')).toBe(t('validation.username'))
    expect(validateUsername('a'.repeat(21))).toBe(t('validation.username'))
    expect(validateUsername('bad name')).toBe(t('validation.username'))
    expect(validateUsername('ünicode')).toBe(t('validation.username'))
  })

  it('validateEmail', () => {
    expect(validateEmail('v@night.city')).toBeNull()
    expect(validateEmail('not-an-email')).toBe(t('validation.email'))
    expect(validateEmail('a@b')).toBe(t('validation.email'))
    expect(validateEmail(`${'a'.repeat(250)}@b.it`)).toBe(t('validation.email'))
  })

  it('validatePassword rejects short and long passwords', () => {
    expect(validatePassword('short', 'x')).toBe(t('validation.passwordLength'))
    expect(validatePassword('a'.repeat(129), 'x')).toBe(t('validation.passwordLength'))
    expect(validatePassword('a-good-long-pass', 'x')).toBeNull()
  })

  it('validatePassword rejects passwords containing the username (case-insensitive)', () => {
    expect(validatePassword('my-Neo2077-password', 'neo2077')).toBe(t('validation.passwordUsername'))
    expect(validatePassword('my-neo2077-password', '')).toBeNull()
  })
})
