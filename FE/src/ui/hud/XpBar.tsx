import { t } from '../i18n/it'
import { Bar } from './Bar'
import styles from './Hud.module.css'

export function XpBar({ xp, xpToNext, level }: { xp: number; xpToNext: number; level: number }) {
  const max = Math.max(1, Math.round(xpToNext))
  const current = Math.max(0, Math.floor(xp))
  return (
    <Bar
      label={t('hud.xp')}
      className={styles.xp}
      value01={current / max}
      now={current}
      max={max}
      text={t('hud.level', { level })}
    />
  )
}
