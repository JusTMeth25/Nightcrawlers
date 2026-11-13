import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS, type GameOptions, type Locale } from '@shared/types'
import { browserLocale, isLocale } from '../i18n/locale'

export const OPTIONS_KEY = 'nc-options'
// 2: adds locale (version 1 options are migrated keeping their values)
const VERSION = 2

export interface OptionsState {
  options: GameOptions
  set(patch: Partial<GameOptions>): void
}

function volume(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
}
function flag(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback
}

/**
 * Anything read from localStorage goes through here: wrong types become the defaults,
 * a missing or unsupported locale becomes `fallbackLocale` (the browser's by default).
 */
export function sanitizeOptions(value: unknown, fallbackLocale: Locale = browserLocale()): GameOptions {
  const o = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    locale: isLocale(o.locale) ? o.locale : fallbackLocale,
    autoAim: flag(o.autoAim, DEFAULT_OPTIONS.autoAim),
    musicVolume: volume(o.musicVolume, DEFAULT_OPTIONS.musicVolume),
    sfxVolume: volume(o.sfxVolume, DEFAULT_OPTIONS.sfxVolume),
    showFps: flag(o.showFps, DEFAULT_OPTIONS.showFps),
    screenShake: flag(o.screenShake, DEFAULT_OPTIONS.screenShake),
  }
}

/** Game options persisted in localStorage (the only persisted UI state); each change emits 'options:changed'. */
export function createOptionsStore() {
  return create<OptionsState>()(
    persist(
      (set, get) => ({
        options: { ...DEFAULT_OPTIONS, locale: browserLocale() },
        set(patch) {
          const options = sanitizeOptions({ ...get().options, ...patch })
          set({ options })
          gameBus.emit('options:changed', options)
        },
      }),
      {
        name: OPTIONS_KEY,
        version: VERSION,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ options: s.options }),
        // version 1 (no locale), unknown versions and corrupted values all end up as sanitized options
        migrate: (persisted) => ({ options: sanitizeOptions((persisted as { options?: unknown } | null)?.options) }),
        merge: (persisted, current) => ({
          ...current,
          options: sanitizeOptions((persisted as { options?: unknown } | null)?.options),
        }),
      },
    ),
  )
}

export const useOptions = createOptionsStore()
