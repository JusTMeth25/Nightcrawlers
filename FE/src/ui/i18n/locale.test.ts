import { afterEach, describe, expect, it } from 'vitest'
import { createOptionsStore } from '../store/options'
import { bindLocaleToOptions, detectLocale, getLocale, setLocale } from './locale'

afterEach(() => {
  setLocale('it')
  localStorage.clear()
})

describe('detectLocale', () => {
  it('picks the first supported browser language', () => {
    expect(detectLocale(['es-ES', 'en'])).toBe('es')
    expect(detectLocale(['it'])).toBe('it')
    expect(detectLocale(['fr-FR', 'en-GB'])).toBe('en')
    expect(detectLocale(['EN-us'])).toBe('en')
  })

  it('falls back to English when nothing is supported', () => {
    expect(detectLocale(['fr-FR', 'de'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('current locale', () => {
  it('setLocale updates getLocale and <html lang>', () => {
    setLocale('es')
    expect(getLocale()).toBe('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('follows the options store once bound', () => {
    const store = createOptionsStore()
    store.getState().set({ locale: 'it' })
    const off = bindLocaleToOptions(store)
    expect(getLocale()).toBe('it')
    store.getState().set({ locale: 'en' })
    expect(getLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    off()
    store.getState().set({ locale: 'es' })
    expect(getLocale()).toBe('en')
  })
})
