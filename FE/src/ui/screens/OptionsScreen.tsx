import { useNavigate } from 'react-router'
import { NeonLink } from '../components/NeonButton'
import { OptionsPanel } from '../components/OptionsPanel'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import styles from './Screens.module.css'

export default function OptionsScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('options.title')}>
        <OptionsPanel />
        <p className={styles.muted}>{t('options.saved')}</p>
        <NeonLink to="/">{t('app.back')}</NeonLink>
      </Panel>
    </div>
  )
}
