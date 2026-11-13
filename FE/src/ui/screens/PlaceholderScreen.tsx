import { useNavigate } from 'react-router'
import { NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t, type TextKey } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'

/** Temporary screen for routes whose screen is not built yet. The title is a key, read at render in the current locale. */
export default function PlaceholderScreen({ titleKey }: { titleKey: TextKey }) {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  return (
    <div ref={navRef}>
      <Panel title={t(titleKey)}>
        <p>{t('app.comingSoon')}</p>
        <NeonLink to="/" autoFocus>
          {t('app.back')}
        </NeonLink>
      </Panel>
    </div>
  )
}
