import { useId } from 'react'
import type { GameOptions } from '@shared/types'
import { t, type TextKey } from '../i18n/it'
import { useOptions } from '../store/options'
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

/** Game options (shared by the Options screen and the pause menu); each change reaches the game at once. */
export function OptionsPanel() {
  return (
    <div className={styles.options}>
      <Volume name="musicVolume" label="options.music" />
      <Volume name="sfxVolume" label="options.sfx" />
      <Flag name="autoAim" label="options.autoAim" hint="options.autoAimHint" />
      <Flag name="showFps" label="options.showFps" />
      <Flag name="screenShake" label="options.screenShake" />
    </div>
  )
}
