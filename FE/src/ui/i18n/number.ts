import type { Locale } from '@shared/types'
import { getLocale } from './locale'

// Thousands are always grouped, in every language (Intl 'es' alone leaves 4-digit numbers ungrouped).
const formatters = new Map<Locale, Intl.NumberFormat>()

/** Number in the current locale: 5000 → 5.000 (it, es) / 5,000 (en); up to 2 decimals. */
export function formatNumber(n: number): string {
  const locale = getLocale()
  let f = formatters.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { useGrouping: 'always', maximumFractionDigits: 2 })
    formatters.set(locale, f)
  }
  return f.format(n)
}
