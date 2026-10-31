import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../../api'
import { isApiError } from '../../../api/errors'
import { ErrorBanner } from '../../components/ErrorBanner'
import { FormField } from '../../components/FormField'
import { NeonButton, NeonLink } from '../../components/NeonButton'
import { Panel } from '../../components/Panel'
import { apiErrorText, fieldErrors } from '../../i18n/apiErrorText'
import { t } from '../../i18n/it'
import { useGamepadNav } from '../../nav/useGamepadNav'
import styles from './AuthScreen.module.css'
import { validateEmail, validatePassword, validateUsername } from './validation'

type Field = 'username' | 'email' | 'password'

export default function RegisterScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const [form, setForm] = useState<Record<Field, string>>({ username: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string | null>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const set = (field: Field) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const username = form.username.trim()
    const email = form.email.trim()
    const next = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(form.password, username),
    }
    setErrors(next)
    if (next.username || next.email || next.password) return
    setBusy(true)
    setError(null)
    try {
      await api.register({ username, email, password: form.password })
      setDone(true)
    } catch (err) {
      const server = fieldErrors(err)
      if (isApiError(err, 409)) {
        setErrors({ username: server.username ?? t('register.usernameTaken') })
      } else if (isApiError(err, 400) && Object.keys(server).length > 0) {
        setErrors({ username: server.username, email: server.email, password: server.password })
      } else {
        setError(apiErrorText(err))
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className={styles.screen} ref={navRef}>
        <Panel title={t('register.checkEmail')}>
          <p>{t('register.checkEmailBody')}</p>
          <div className={styles.actions}>
            <NeonLink to="/login" variant="primary" autoFocus>
              {t('login.submit')}
            </NeonLink>
            <NeonLink to="/">{t('app.home')}</NeonLink>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('register.title')}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <FormField
            label={t('form.username')}
            name="username"
            autoComplete="username"
            autoFocus
            maxLength={20}
            value={form.username}
            error={errors.username}
            onChange={set('username')}
          />
          <FormField
            label={t('form.email')}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={form.email}
            error={errors.email}
            onChange={set('email')}
          />
          <FormField
            label={t('form.password')}
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            hint={t('register.passwordHint')}
            value={form.password}
            error={errors.password}
            onChange={set('password')}
          />
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <NeonButton type="submit" variant="primary" block disabled={busy}>
            {busy ? t('form.sending') : t('register.submit')}
          </NeonButton>
        </form>
        <div className={styles.links}>
          <Link data-nav to="/login">
            {t('register.hasAccount')}
          </Link>
        </div>
      </Panel>
    </div>
  )
}
