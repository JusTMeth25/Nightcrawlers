import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../api'
import { isApiError } from '../../../api/errors'
import { ErrorBanner } from '../../components/ErrorBanner'
import { FormField } from '../../components/FormField'
import { NeonButton, NeonLink } from '../../components/NeonButton'
import { Panel } from '../../components/Panel'
import { apiErrorText } from '../../i18n/apiErrorText'
import { t } from '../../i18n/it'
import { useGamepadNav } from '../../nav/useGamepadNav'
import styles from './AuthScreen.module.css'
import { validateEmail } from './validation'

export default function ForgotPasswordScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/login') })
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const value = email.trim()
    const invalid = validateEmail(value)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      await api.forgotPassword({ email: value })
      setDone(true)
    } catch (err) {
      // same answer whatever the account state; only transport problems are reported
      if (isApiError(err) && (err.status === 0 || err.status === 429)) setError(apiErrorText(err))
      else setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('forgot.title')}>
        {done ? (
          <>
            <ErrorBanner tone="info">{t('forgot.done')}</ErrorBanner>
            <NeonLink to="/login" variant="primary" autoFocus>
              {t('login.submit')}
            </NeonLink>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <p>{t('forgot.intro')}</p>
            <FormField
              label={t('form.email')}
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              maxLength={254}
              value={email}
              error={fieldError}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <NeonButton type="submit" variant="primary" block disabled={busy}>
              {busy ? t('form.sending') : t('forgot.submit')}
            </NeonButton>
            <NeonLink to="/login">{t('app.back')}</NeonLink>
          </form>
        )}
      </Panel>
    </div>
  )
}
