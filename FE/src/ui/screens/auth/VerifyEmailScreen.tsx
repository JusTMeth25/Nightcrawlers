import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../../api'
import { isApiError } from '../../../api/errors'
import { ErrorBanner } from '../../components/ErrorBanner'
import { NeonButton, NeonLink } from '../../components/NeonButton'
import { Panel } from '../../components/Panel'
import { Spinner } from '../../components/Spinner'
import { apiErrorText } from '../../i18n/apiErrorText'
import { t } from '../../i18n/it'
import { useGamepadNav } from '../../nav/useGamepadNav'
import { useSession } from '../../store/session'
import styles from './AuthScreen.module.css'

type Status = 'checking' | 'success' | 'invalid' | 'error'

function isTransient(error: unknown) {
  return isApiError(error) && (error.status === 0 || error.status === 429 || error.status >= 500)
}

// Email tokens are single use: StrictMode re-runs effects, so each token is sent once per page.
// Success and definitive answers (400) stay cached; transient failures are dropped to allow a retry.
const verifications = new Map<string, Promise<void>>()
function verifyOnce(token: string) {
  let p = verifications.get(token)
  if (!p) {
    p = api.verifyEmail({ token })
    verifications.set(token, p)
    p.catch((error: unknown) => {
      if (isTransient(error) && verifications.get(token) === p) verifications.delete(token)
    })
  }
  return p
}

export default function VerifyEmailScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'invalid')
  const [resend, setResend] = useState<{ busy: boolean; message: string | null; error: string | null }>({
    busy: false,
    message: null,
    error: null,
  })
  const session = useSession((s) => s.status)
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const [attempt, setAttempt] = useState(0)
  const [errorText, setErrorText] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    verifyOnce(token).then(
      () => {
        if (!alive) return
        setStatus('success')
        const current = useSession.getState().user
        if (current && !current.emailVerified) setUser({ ...current, emailVerified: true })
      },
      (error: unknown) => {
        if (!alive) return
        if (isTransient(error)) {
          setErrorText(apiErrorText(error))
          setStatus('error')
        } else setStatus('invalid')
      },
    )
    return () => {
      alive = false
    }
  }, [token, setUser, attempt])

  const onRetry = () => {
    setStatus('checking')
    setAttempt((n) => n + 1)
  }

  const onResend = async () => {
    setResend({ busy: true, message: null, error: null })
    try {
      await api.resendVerification()
      setResend({ busy: false, message: t('verify.resent'), error: null })
    } catch (err) {
      setResend({ busy: false, message: null, error: apiErrorText(err) })
    }
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('verify.title')}>
        {status === 'checking' && <Spinner label={t('verify.checking')} />}
        {status === 'success' && (
          <>
            <ErrorBanner tone="info">{t('verify.success')}</ErrorBanner>
            <NeonLink to={session === 'authenticated' ? '/select' : '/login'} variant="primary" autoFocus>
              {session === 'authenticated' ? t('menu.play') : t('login.submit')}
            </NeonLink>
          </>
        )}
        {status === 'error' && (
          <>
            <ErrorBanner>{errorText}</ErrorBanner>
            <NeonButton variant="primary" onClick={onRetry} autoFocus>
              {t('app.retry')}
            </NeonButton>
          </>
        )}
        {status === 'invalid' && (
          <>
            <ErrorBanner>{t('verify.invalid')}</ErrorBanner>
            {session === 'authenticated' && user && !user.emailVerified ? (
              <NeonButton variant="primary" onClick={onResend} disabled={resend.busy} autoFocus>
                {t('verify.resend')}
              </NeonButton>
            ) : session !== 'authenticated' ? (
              <p>{t('verify.loginToResend')}</p>
            ) : null}
            {resend.message && <ErrorBanner tone="info">{resend.message}</ErrorBanner>}
            {resend.error && <ErrorBanner>{resend.error}</ErrorBanner>}
            <div className={styles.actions}>
              {session !== 'authenticated' && <NeonLink to="/login">{t('login.submit')}</NeonLink>}
              <NeonLink to="/">{t('app.home')}</NeonLink>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
