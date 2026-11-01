import { useNavigate } from 'react-router'
import { NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import styles from './Screens.module.css'

// contact address configurable at build time (VITE_PRIVACY_EMAIL)
const PRIVACY_EMAIL: string = import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@nightcrawlers.duckdns.org'

export default function PrivacyScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate(-1) })
  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('privacy.title')} wide>
        <div className={styles.prose}>
          <p>{t('privacy.intro')}</p>
          <h3>{t('privacy.dataTitle')}</h3>
          <ul>
            <li>{t('privacy.data1')}</li>
            <li>{t('privacy.data2')}</li>
            <li>{t('privacy.data3')}</li>
            <li>{t('privacy.data4')}</li>
            <li>{t('privacy.data5')}</li>
          </ul>
          <h3>{t('privacy.purposeTitle')}</h3>
          <p>{t('privacy.purpose')}</p>
          <h3>{t('privacy.retentionTitle')}</h3>
          <p>{t('privacy.retention')}</p>
          <p>{t('privacy.backups')}</p>
          <h3>{t('privacy.processorsTitle')}</h3>
          <p>{t('privacy.processors1')}</p>
          <p>{t('privacy.processors2')}</p>
          <h3>{t('privacy.rightsTitle')}</h3>
          <p>{t('privacy.rights')}</p>
          <h3>{t('privacy.cookiesTitle')}</h3>
          <p>{t('privacy.cookies')}</p>
          <h3>{t('privacy.guestTitle')}</h3>
          <p>{t('privacy.guest')}</p>
          <h3>{t('privacy.contactTitle')}</h3>
          <p>{t('privacy.contact', { email: PRIVACY_EMAIL })}</p>
          <p className={styles.muted}>{t('app.disclaimer')}</p>
        </div>
        <NeonLink to="/" autoFocus>
          {t('app.home')}
        </NeonLink>
      </Panel>
    </div>
  )
}
