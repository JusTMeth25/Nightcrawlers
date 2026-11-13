import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS } from '@shared/types'
import { createOptionsStore, OPTIONS_KEY, sanitizeOptions } from './options'

// jsdom reports navigator.languages = ['en-US']: a missing locale is detected as English
const detected = { ...DEFAULT_OPTIONS, locale: 'en' as const }

beforeEach(() => localStorage.clear())
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('options store', () => {
  it('falls back to the defaults when the stored JSON is corrupted', () => {
    localStorage.setItem(OPTIONS_KEY, '{not json')
    const store = createOptionsStore()
    expect(store.getState().options).toEqual(detected)
  })

  it('restores valid stored options', () => {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify({ state: { options: { ...DEFAULT_OPTIONS, autoAim: true } }, version: 2 }))
    const store = createOptionsStore()
    expect(store.getState().options.autoAim).toBe(true)
  })

  it('migrates version 1 options (no locale) keeping every value and detecting the locale', () => {
    const v1 = { autoAim: true, musicVolume: 0.2, sfxVolume: 0.3, showFps: true, screenShake: false }
    localStorage.setItem(OPTIONS_KEY, JSON.stringify({ state: { options: v1 }, version: 1 }))
    const store = createOptionsStore()
    expect(store.getState().options).toEqual({ ...v1, locale: 'en' })
    expect(JSON.parse(localStorage.getItem(OPTIONS_KEY)!).version).toBe(2)
  })

  it('keeps a stored locale and rejects an unsupported one', () => {
    expect(sanitizeOptions({ locale: 'es' }).locale).toBe('es')
    expect(sanitizeOptions({ locale: 'fr' }).locale).toBe('en')
    expect(sanitizeOptions({}, 'it').locale).toBe('it')
  })

  it('starts with the detected locale when nothing is stored', () => {
    const store = createOptionsStore()
    expect(store.getState().options).toEqual(detected)
  })

  it('replaces wrong types and clamps the volumes', () => {
    expect(sanitizeOptions({ autoAim: 'yes', musicVolume: 3, sfxVolume: -1, showFps: true, screenShake: null })).toEqual({
      ...detected,
      musicVolume: 1,
      sfxVolume: 0,
      showFps: true,
    })
    expect(sanitizeOptions('garbage')).toEqual(detected)
  })

  it('set() emits options:changed with the full options and persists only the options', () => {
    const store = createOptionsStore()
    const changed = vi.fn()
    const off = gameBus.on('options:changed', changed)
    store.getState().set({ autoAim: true })
    off()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith({ ...detected, autoAim: true })
    const stored = JSON.parse(localStorage.getItem(OPTIONS_KEY)!)
    expect(stored).toEqual({ state: { options: { ...detected, autoAim: true } }, version: 2 })
  })
})
