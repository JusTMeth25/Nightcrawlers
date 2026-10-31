import { useNavigate } from 'react-router'
import { NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'

/** Temporary screen for routes whose screen is not built yet. */
export default function PlaceholderScreen({ title }: { title: string }) {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  return (
    <div ref={navRef}>
      <Panel title={title}>
        <p>{t('app.comingSoon')}</p>
        <NeonLink to="/" autoFocus>
          {t('app.back')}
        </NeonLink>
      </Panel>
    </div>
  )
}
