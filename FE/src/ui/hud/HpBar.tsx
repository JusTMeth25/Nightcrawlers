import { t } from '../i18n/it'
import { Bar } from './Bar'
import styles from './Hud.module.css'

export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const current = Math.max(0, Math.ceil(hp))
  const max = Math.max(1, Math.round(maxHp))
  return (
    <Bar
      label={t('hud.hp')}
      className={styles.hp}
      value01={current / max}
      now={current}
      max={max}
      text={`${current}/${max}`}
    />
  )
}
