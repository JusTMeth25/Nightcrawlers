import { t } from '../i18n/it'
import styles from './Spinner.module.css'

export function Spinner({ label = t('app.loading'), fullscreen = false }: { label?: string; fullscreen?: boolean }) {
  return (
    <div role="status" className={[styles.wrap, fullscreen && styles.fullscreen].filter(Boolean).join(' ')}>
      <span className={styles.ring} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
