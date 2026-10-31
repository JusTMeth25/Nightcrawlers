import { NeonLink } from '../components/NeonButton'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useSession } from '../store/session'
import styles from './TitleScreen.module.css'

export default function TitleScreen() {
  const status = useSession((s) => s.status)
  const user = useSession((s) => s.user)
  const navRef = useGamepadNav()
  const authenticated = status === 'authenticated'

  return (
    <div className={styles.title} ref={navRef}>
      <h1 className={styles.logo}>{t('app.title')}</h1>
      <p className={styles.tagline}>{t('app.tagline')}</p>
      <nav aria-label={t('app.home')}>
        <ul className={styles.menu}>
          <li>
            <NeonLink to="/select" variant="primary" block autoFocus>
              {t('menu.play')}
            </NeonLink>
          </li>
          <li>
            {authenticated ? (
              <NeonLink to="/account" block>
                {t('menu.account')}
              </NeonLink>
            ) : (
              <NeonLink to="/login" block>
                {t('menu.login')}
              </NeonLink>
            )}
          </li>
          <li>
            <NeonLink to="/ripperdoc" block>
              {t('menu.ripperdoc')}
            </NeonLink>
          </li>
          <li>
            <NeonLink to="/codex" block>
              {t('menu.codex')}
            </NeonLink>
          </li>
          <li>
            <NeonLink to="/options" block>
              {t('menu.options')}
            </NeonLink>
          </li>
        </ul>
      </nav>
      <p className={styles.status}>
        {authenticated && user ? t('menu.greeting', { username: user.username }) : t('menu.guest')}
      </p>
      <p className={styles.disclaimer}>{t('app.disclaimer')}</p>
    </div>
  )
}
