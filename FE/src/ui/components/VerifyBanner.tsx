import { t } from '../i18n/it'
import { useSession } from '../store/session'
import styles from './VerifyBanner.module.css'
import { ResendVerification } from './ResendVerification'

/** Shown on the screens while the logged-in user has not verified the email (runs are not saved). */
export function VerifyBanner() {
  const status = useSession((s) => s.status)
  const user = useSession((s) => s.user)
  if (status !== 'authenticated' || !user || user.emailVerified) return null
  return (
    <div className={styles.banner} role="region" aria-label={t('banner.unverified')}>
      <span>{t('banner.unverified')}</span>
      <ResendVerification />
    </div>
  )
}
