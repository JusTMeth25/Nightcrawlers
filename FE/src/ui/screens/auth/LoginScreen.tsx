import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { isApiError } from '../../../api/errors'
import { ErrorBanner } from '../../components/ErrorBanner'
import { FormField } from '../../components/FormField'
import { NeonButton } from '../../components/NeonButton'
import { Panel } from '../../components/Panel'
import { apiErrorText } from '../../i18n/apiErrorText'
import { t } from '../../i18n/it'
import { useGamepadNav } from '../../nav/useGamepadNav'
import { useSession } from '../../store/session'
import styles from './AuthScreen.module.css'
import { required } from './validation'

interface LoginLocationState {
  from?: string
  expired?: boolean
}

function loginErrorText(error: unknown): string {
  if (isApiError(error, 401)) return t('login.invalid')
  if (isApiError(error, 423)) {
    return error.retryAfterSec !== null ? t('login.locked', { seconds: error.retryAfterSec }) : t('login.lockedShort')
  }
  return apiErrorText(error)
}

export default function LoginScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LoginLocationState
  const login = useSession((s) => s.login)
  const playAsGuest = useSession((s) => s.playAsGuest)
  const navRef = useGamepadNav({ onBack: () => navigate('/') })

  const [form, setForm] = useState({ login: '', password: '' })
  const [errors, setErrors] = useState<{ login?: string | null; password?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next = { login: required(form.login), password: required(form.password) }
    setErrors(next)
    if (next.login || next.password) return
    setBusy(true)
    setError(null)
    try {
      await login({ login: form.login.trim(), password: form.password })
      const target = state.from && state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/select'
      navigate(target, { replace: true })
    } catch (err) {
      setError(loginErrorText(err))
      setForm((f) => ({ ...f, password: '' }))
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('login.title')}>
        {state.expired && <ErrorBanner tone="info">{t('app.sessionExpired')}</ErrorBanner>}
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <FormField
            label={t('form.login')}
            name="login"
            autoComplete="username"
            autoFocus
            maxLength={254}
            value={form.login}
            error={errors.login}
            onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
          />
          <FormField
            label={t('form.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={form.password}
            error={errors.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <NeonButton type="submit" variant="primary" block disabled={busy}>
            {busy ? t('form.sending') : t('login.submit')}
          </NeonButton>
        </form>
        <div className={styles.links}>
          <Link data-nav to="/forgot-password">
            {t('login.forgot')}
          </Link>
          <Link data-nav to="/register">
            {t('login.register')}
          </Link>
        </div>
        <NeonButton
          block
          onClick={() => {
            playAsGuest()
            navigate('/select')
          }}
        >
          {t('login.guest')}
        </NeonButton>
      </Panel>
    </div>
  )
}
