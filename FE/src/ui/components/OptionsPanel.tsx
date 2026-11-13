import { useEffect, useId, useRef } from 'react'
import { SUPPORTED_LOCALES, type GameOptions, type Locale } from '@shared/types'
import { t, type TextKey } from '../i18n/it'
import { isLocale } from '../i18n/locale'
import { useOptions } from '../store/options'
import { useSession } from '../store/session'
import styles from '../screens/Screens.module.css'

type VolumeKey = 'musicVolume' | 'sfxVolume'
type FlagKey = 'autoAim' | 'showFps' | 'screenShake'

function Volume({ name, label }: { name: VolumeKey; label: TextKey }) {
  const id = useId()
  const value = useOptions((s) => s.options[name])
  const set = useOptions((s) => s.set)
  return (
    <div className={styles.option}>
      <label htmlFor={id}>{t(label)}</label>
      <input
        id={id}
        data-nav
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => set({ [name]: Number(e.target.value) } as Partial<GameOptions>)}
      />
      <span className={styles.muted} aria-hidden="true">
        {t('options.percent', { value: Math.round(value * 100) })}
      </span>
    </div>
  )
}

function Flag({ name, label, hint }: { name: FlagKey; label: TextKey; hint?: TextKey }) {
  const id = useId()
  const value = useOptions((s) => s.options[name])
  const set = useOptions((s) => s.set)
  return (
    <div className={styles.option}>
      <label htmlFor={id}>
        {t(label)}
        {hint && <span className={styles.muted}> — {t(hint)}</span>}
      </label>
      <input
        id={id}
        data-nav
        type="checkbox"
        checked={value}
        onChange={(e) => set({ [name]: e.target.checked } as Partial<GameOptions>)}
      />
    </div>
  )
}

// each language by its own name, never translated
const LANGUAGE_NAMES: Record<Locale, string> = { it: 'Italiano', en: 'English', es: 'Español' }

// set by a language change: the selector mounted by the remount (App key) takes the focus back
let refocusLanguage = false

/**
 * Changing language remounts the interface (App key), so during a run the selector is disabled.
 * The choice is saved on this device and, when logged in, on the account (emails).
 */
function Language({ inRun }: { inRun: boolean }) {
  const id = useId()
  const noteId = useId()
  const value = useOptions((s) => s.options.locale)
  const set = useOptions((s) => s.set)
  const selectRef = useRef<HTMLSelectElement | null>(null)

  // runs on the remounted selector, or on the same one when nothing remounts: the flag never lingers
  useEffect(() => {
    if (!refocusLanguage) return
    refocusLanguage = false
    selectRef.current?.focus()
  }, [value])

  return (
    <div className={styles.option}>
      <label htmlFor={id}>{t('options.language')}</label>
      <select
        ref={selectRef}
        id={id}
        data-nav
        value={value}
        disabled={inRun}
        aria-describedby={inRun ? noteId : undefined}
        onChange={(e) => {
          const locale = e.target.value
          if (inRun || !isLocale(locale) || locale === value) return
          refocusLanguage = true
          set({ locale })
          void useSession.getState().updateLocale(locale)
        }}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
      {inRun && (
        <span id={noteId} className={styles.muted}>
          {t('options.languageInRun')}
        </span>
      )}
    </div>
  )
}

/** Game options (shared by the Options screen and the pause menu); each change reaches the game at once. */
export function OptionsPanel({ inRun = false }: { inRun?: boolean }) {
  return (
    <div className={styles.options}>
      <Language inRun={inRun} />
      <Volume name="musicVolume" label="options.music" />
      <Volume name="sfxVolume" label="options.sfx" />
      <Flag name="autoAim" label="options.autoAim" hint="options.autoAimHint" />
      <Flag name="showFps" label="options.showFps" />
      <Flag name="screenShake" label="options.screenShake" />
    </div>
  )
}
