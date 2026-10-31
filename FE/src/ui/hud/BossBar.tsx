import { t } from '../i18n/it'
import { Bar } from './Bar'
import styles from './Hud.module.css'

export function BossBar({ hp01 }: { hp01: number }) {
  return <Bar label={t('hud.boss')} className={styles.boss} value01={hp01} />
}
