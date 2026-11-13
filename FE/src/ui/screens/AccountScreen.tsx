import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../api'
import { isApiError } from '../../api/errors'
import { ErrorBanner } from '../components/ErrorBanner'
import { FormField } from '../components/FormField'
import { NeonButton, NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { ResendVerification } from '../components/ResendVerification'
import { apiErrorText } from '../i18n/apiErrorText'
import { t } from '../i18n/it'
import { getLocale } from '../i18n/locale'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useSession } from '../store/session'
import { required } from './auth/validation'
import styles from './Screens.module.css'

const EXPORT_FILENAME = 'nightcrawlers-export.json'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 403 = wrong password (401 is reserved for an expired session): no refresh, stay here.
 *  423 = too many wrong passwords: the backend locked the account and revoked every session, so a later
 *  call may end the session (refresh 401) and the normal session-lost flow takes over.
 *  409 = lock conflict: the generic text asks to retry. */
function deleteErrorText(error: unknown): string {
  if (isApiError(error, 403)) return t('account.wrongPassword')
  if (isApiError(error, 423)) {
    return error.retryAfterSec !== null
      ? t('account.locked', { seconds: error.retryAfterSec })
      : t('account.lockedShort')
  }
  return apiErrorText(error)
}

type Busy = null | 'logout' | 'logoutAll' | 'export' | 'delete'

export default function AccountScreen() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const signOutLocally = useSession((s) => s.playAsGuest)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const navRef = useGamepadNav({ onBack: () => (confirming ? setConfirming(false) : navigate('/')) })

  // the session ends only once the title screen has replaced /account (this screen unmounts):
  // signing out first would let RequireAuth re-render /account as guest and redirect to /login.
  // The router commits navigations in a transition, so ordering the calls is not enough.
  const signOutOnLeave = useRef(false)
  useEffect(
    () => () => {
      if (signOutOnLeave.current) signOutLocally()
    },
    [signOutLocally],
  )
  const leaveSignedOut = () => {
    signOutOnLeave.current = true
    navigate('/', { replace: true })
  }

  if (!user) return null

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    if (busy) return
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setError(apiErrorText(err))
    } finally {
      setBusy(null)
    }
  }

  const onLogout = () =>
    run('logout', async () => {
      navigate('/', { replace: true })
      await logout()
    })

  const onLogoutAll = () =>
    run('logoutAll', async () => {
      await api.logoutAll()
      leaveSignedOut()
    })

  const onExport = () =>
    run('export', async () => {
      download(await api.exportData(), EXPORT_FILENAME)
      setNotice(t('account.exported'))
    })

  const onDelete = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const missing = required(password)
    setPasswordError(missing)
    if (missing) return
    setBusy('delete')
    setError(null)
    try {
      await api.deleteAccount({ password })
      leaveSignedOut()
    } catch (err) {
      setError(deleteErrorText(err))
      setPassword('')
      setBusy(null)
    }
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('account.title')}>
        <dl className={styles.facts}>
          <dt>{t('account.username')}</dt>
          <dd>{user.username}</dd>
          <dt>{t('account.email')}</dt>
          <dd>{user.email}</dd>
          <dt>{t('account.status')}</dt>
          <dd className={user.emailVerified ? styles.success : styles.warning}>
            {user.emailVerified ? t('account.verified') : t('account.notVerified')}
          </dd>
          <dt>{t('account.since')}</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString(getLocale())}</dd>
        </dl>
        {!user.emailVerified && <ResendVerification />}

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {notice && <ErrorBanner tone="info">{notice}</ErrorBanner>}

        <div className={styles.actions}>
          <NeonButton onClick={() => void onLogout()} disabled={busy !== null} autoFocus>
            {t('account.logout')}
          </NeonButton>
          <NeonButton onClick={() => void onLogoutAll()} disabled={busy !== null}>
            {t('account.logoutAll')}
          </NeonButton>
          <NeonButton onClick={() => void onExport()} disabled={busy !== null}>
            {t('account.export')}
          </NeonButton>
          {!confirming && (
            <NeonButton variant="danger" onClick={() => setConfirming(true)} disabled={busy !== null}>
              {t('account.delete')}
            </NeonButton>
          )}
        </div>

        {confirming && (
          <form className={styles.details} onSubmit={onDelete} noValidate>
            <p className={styles.warning}>{t('account.deleteWarning')}</p>
            <FormField
              label={t('form.password')}
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              autoFocus
              value={password}
              error={passwordError}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className={styles.actions}>
              <NeonButton type="submit" variant="danger" disabled={busy !== null}>
                {t('account.deleteConfirm')}
              </NeonButton>
              <NeonButton
                onClick={() => {
                  setConfirming(false)
                  setPassword('')
                  setError(null)
                }}
              >
                {t('account.deleteCancel')}
              </NeonButton>
            </div>
          </form>
        )}

        <div className={styles.actions}>
          <NeonLink to="/privacy">{t('account.privacy')}</NeonLink>
          <NeonLink to="/">{t('app.back')}</NeonLink>
        </div>
      </Panel>
    </div>
  )
}
