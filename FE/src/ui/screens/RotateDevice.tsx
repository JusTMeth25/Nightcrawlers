import { t } from '../i18n/it'
import styles from './PlayScreen.module.css'

/** Covers the game on a vertical touch screen. */
export function RotateDevice() {
  return (
    <div className={styles.rotate} role="alertdialog" aria-modal="true" aria-labelledby="nc-rotate-title">
      <span className={styles.rotateIcon} aria-hidden="true" />
      <h2 id="nc-rotate-title">{t('play.rotateTitle')}</h2>
      <p>{t('play.rotateBody')}</p>
    </div>
  )
}
