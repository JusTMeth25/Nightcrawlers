import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from './locale'
import { formatNumber } from './number'

afterEach(() => setLocale('it'))

describe('formatNumber', () => {
  // one rule in every language: thousands are always grouped (Intl 'es' alone would not group 4 digits)
  it.each([
    ['it', '5.000', '1.234.567', '0,5'],
    ['en', '5,000', '1,234,567', '0.5'],
    ['es', '5.000', '1.234.567', '0,5'],
  ] as const)('%s', (locale, thousands, millions, half) => {
    setLocale(locale)
    expect(formatNumber(5000)).toBe(thousands)
    expect(formatNumber(1234567)).toBe(millions)
    expect(formatNumber(0.5)).toBe(half)
    expect(formatNumber(12)).toBe('12')
  })
})
