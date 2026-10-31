import { Link } from 'react-router'
import { t } from '../i18n/it'
import styles from './AppShell.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>{t('app.disclaimer')}</p>
      <Link to="/privacy">{t('app.privacy')}</Link>
    </footer>
  )
}
