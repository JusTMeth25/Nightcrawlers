import { SUPPORTED_LOCALES, type Locale } from '@shared/types'

// Current interface language, read by t(), the data texts and the API client (Accept-Language).
// It mirrors GameOptions.locale once bindLocaleToOptions() runs (main.tsx); tests start in Italian.
let current: Locale = 'it'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** First browser language starting with a supported locale (es-ES → es); English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0]
    if (isLocale(base)) return base
  }
  return 'en'
}

/** Locale detected from navigator.languages (first start, missing or invalid stored value). */
export function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language ?? '']
  return detectLocale(languages)
}

export function getLocale(): Locale {
  return current
}

/** Changes the current locale and the document language (<html lang>). */
export function setLocale(locale: Locale): void {
  current = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

interface LocaleSource {
  getState(): { options: { locale: Locale } }
  subscribe(listener: (state: { options: { locale: Locale } }) => void): () => void
}

/** Keeps the current locale equal to the options store's locale; returns the unsubscribe. */
export function bindLocaleToOptions(store: LocaleSource): () => void {
  setLocale(store.getState().options.locale)
  return store.subscribe((state) => {
    if (state.options.locale !== current) setLocale(state.options.locale)
  })
}
