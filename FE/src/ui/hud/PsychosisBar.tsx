import { t } from '../i18n/it'
import { Bar } from './Bar'
import styles from './Hud.module.css'

export function PsychosisBar({ psychosis, active }: { psychosis: number; active: boolean }) {
  const value = Math.round(Math.min(100, Math.max(0, psychosis)))
  return (
    <Bar
      label={active ? t('hud.cyberpsychosis') : t('hud.psychosis')}
      className={[styles.psychosis, active && styles.psychosisActive].filter(Boolean).join(' ')}
      value01={active ? 1 : value / 100}
      now={value}
      max={100}
    />
  )
}
