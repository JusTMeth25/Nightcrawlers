import { t } from '../i18n/it'
import { formatTime } from './format'
import styles from './Hud.module.css'

export function Timer({ timeSec }: { timeSec: number }) {
  return (
    <time className={styles.timer} aria-label={t('hud.time')}>
      {formatTime(timeSec)}
    </time>
  )
}
