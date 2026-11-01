import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS } from '@shared/types'
import { createOptionsStore, OPTIONS_KEY, sanitizeOptions } from './options'

beforeEach(() => localStorage.clear())
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('options store', () => {
  it('falls back to the defaults when the stored JSON is corrupted', () => {
    localStorage.setItem(OPTIONS_KEY, '{not json')
    const store = createOptionsStore()
    expect(store.getState().options).toEqual(DEFAULT_OPTIONS)
  })

  it('restores valid stored options', () => {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify({ state: { options: { ...DEFAULT_OPTIONS, autoAim: true } }, version: 1 }))
    const store = createOptionsStore()
    expect(store.getState().options.autoAim).toBe(true)
  })

  it('replaces wrong types and clamps the volumes', () => {
    expect(sanitizeOptions({ autoAim: 'yes', musicVolume: 3, sfxVolume: -1, showFps: true, screenShake: null })).toEqual({
      ...DEFAULT_OPTIONS,
      musicVolume: 1,
      sfxVolume: 0,
      showFps: true,
    })
    expect(sanitizeOptions('garbage')).toEqual(DEFAULT_OPTIONS)
  })

  it('set() emits options:changed with the full options and persists only the options', () => {
    const store = createOptionsStore()
    const changed = vi.fn()
    const off = gameBus.on('options:changed', changed)
    store.getState().set({ autoAim: true })
    off()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith({ ...DEFAULT_OPTIONS, autoAim: true })
    const stored = JSON.parse(localStorage.getItem(OPTIONS_KEY)!)
    expect(stored).toEqual({ state: { options: { ...DEFAULT_OPTIONS, autoAim: true } }, version: 1 })
  })
})
