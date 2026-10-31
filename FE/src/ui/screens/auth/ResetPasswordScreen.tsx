import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../../api'
import { isApiError } from '../../../api/errors'
import { ErrorBanner } from '../../components/ErrorBanner'
import { FormField } from '../../components/FormField'
import { NeonButton, NeonLink } from '../../components/NeonButton'
import { Panel } from '../../components/Panel'
import { apiErrorText, fieldErrors } from '../../i18n/apiErrorText'
import { t } from '../../i18n/it'
import { useGamepadNav } from '../../nav/useGamepadNav'
import { useSession } from '../../store/session'
import styles from './AuthScreen.module.css'
import { validatePassword } from './validation'

export default function ResetPasswordScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next = {
      password: validatePassword(form.password, useSession.getState().user?.username ?? ''),
      confirm: form.password === form.confirm ? null : t('validation.passwordMismatch'),
    }
    setErrors(next)
    if (next.password || next.confirm) return
    setBusy(true)
    setError(null)
    try {
      await api.resetPassword({ token, newPassword: form.password })
      // the server revoked every session, this one included
      if (useSession.getState().status === 'authenticated') useSession.getState().playAsGuest()
      setDone(true)
    } catch (err) {
      const server = fieldErrors(err)
      if (isApiError(err, 400) && server.newPassword) setErrors({ password: server.newPassword })
      else if (isApiError(err, 400)) setError(t('reset.invalid'))
      else setError(apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className={styles.screen} ref={navRef}>
        <Panel title={t('reset.title')}>
          <ErrorBanner>{t('reset.missingToken')}</ErrorBanner>
          <NeonLink to="/forgot-password" autoFocus>
            {t('login.forgot')}
          </NeonLink>
        </Panel>
      </div>
    )
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('reset.title')}>
        {done ? (
          <>
            <ErrorBanner tone="info">{t('reset.done')}</ErrorBanner>
            <NeonLink to="/login" variant="primary" autoFocus>
              {t('login.submit')}
            </NeonLink>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <FormField
              label={t('form.newPassword')}
              name="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              maxLength={128}
              hint={t('register.passwordHint')}
              value={form.password}
              error={errors.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <FormField
              label={t('form.confirmPassword')}
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              value={form.confirm}
              error={errors.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            />
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <NeonButton type="submit" variant="primary" block disabled={busy}>
              {busy ? t('form.sending') : t('reset.submit')}
            </NeonButton>
          </form>
        )}
      </Panel>
    </div>
  )
}
