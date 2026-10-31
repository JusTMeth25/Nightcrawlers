import { ErrorBanner } from '../components/ErrorBanner'
import { NeonButton } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useSession } from '../store/session'
import styles from './AppShell.module.css'

/** /auth/refresh unreachable at startup (network, 429, 5xx): retry, or play as guest knowingly. */
export function BootstrapError() {
  const bootstrap = useSession((s) => s.bootstrap)
  const playAsGuest = useSession((s) => s.playAsGuest)
  const navRef = useGamepadNav()
  return (
    <div className={styles.main} ref={navRef}>
      <Panel title={t('app.title')}>
        <ErrorBanner>{t('error.network')}</ErrorBanner>
        <div className={styles.actions}>
          <NeonButton variant="primary" autoFocus onClick={() => void bootstrap()}>
            {t('app.retry')}
          </NeonButton>
          <NeonButton onClick={playAsGuest}>{t('login.guest')}</NeonButton>
        </div>
      </Panel>
    </div>
  )
}
