import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getCharacter } from '@data'
import { ErrorBanner } from '../components/ErrorBanner'
import { NeonButton, NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { Spinner } from '../components/Spinner'
import { formatTime } from '../hud/format'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import styles from './Screens.module.css'

export default function GameOverScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const { config, result, outcome, submitting, submitError, canRetry, needsLogin, retrySubmit, start } = useRun()
  const status = useSession((s) => s.status)
  const sessionExpired = useSession((s) => s.sessionExpired)
  const clearExpired = useSession((s) => s.clearExpired)
  const [starting, setStarting] = useState(false)

  // the shell does not redirect on /play and /game-over: the expiry is handled here
  useEffect(() => {
    if (sessionExpired) clearExpired()
  }, [sessionExpired, clearExpired])

  // back from the login: send the kept result
  useEffect(() => {
    if (needsLogin && status === 'authenticated') void retrySubmit()
  }, [needsLogin, status, retrySubmit])

  if (!config || !result) return <Navigate to="/select" replace />

  const onlineRun = config.mode === 'online'
  const pending = onlineRun && !outcome && (submitting || needsLogin || (submitError !== null && canRetry))

  const playAgain = async () => {
    if (starting) return
    setStarting(true)
    const res = await start()
    navigate(res === 'started' ? '/play' : '/select')
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('gameOver.title')} wide>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{t('gameOver.time')}</dt>
            <dd>{formatTime(result.durationSec)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('gameOver.kills')}</dt>
            <dd>{result.kills}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('gameOver.level')}</dt>
            <dd>{result.level}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('gameOver.collected')}</dt>
            <dd>{result.eurodollarsCollected}</dd>
          </div>
        </dl>

        {!onlineRun && (
          <>
            <p className={styles.muted}>{t('gameOver.guest')}</p>
            {status !== 'authenticated' && (
              <NeonLink to="/register" variant="primary">
                {t('gameOver.register')}
              </NeonLink>
            )}
          </>
        )}

        {onlineRun && submitting && <Spinner label={t('gameOver.submitting')} />}

        {onlineRun && outcome && (
          <section aria-live="polite">
            <p className={styles.success}>{t('gameOver.awarded', { amount: outcome.eurodollarsAwarded })}</p>
            <p className={styles.muted}>{t('gameOver.balance', { amount: outcome.save.eurodollars })}</p>
            {outcome.newUnlocks.map((id) => (
              <p key={id} className={styles.success}>
                {t('gameOver.unlocked', { name: getCharacter(id).name })}
              </p>
            ))}
            {outcome.flagged && <ErrorBanner>{t('gameOver.flagged')}</ErrorBanner>}
          </section>
        )}

        {onlineRun && !outcome && !submitting && needsLogin && (
          <>
            <ErrorBanner tone="info">{t('gameOver.loginRequired')}</ErrorBanner>
            <p className={styles.muted}>{t('gameOver.keptInMemory')}</p>
            <NeonLink to="/login" state={{ from: '/game-over', expired: true }} variant="primary">
              {t('gameOver.loginAgain')}
            </NeonLink>
          </>
        )}

        {onlineRun && !outcome && !submitting && !needsLogin && submitError && (
          <>
            <ErrorBanner>{submitError}</ErrorBanner>
            {canRetry && (
              <>
                <p className={styles.muted}>{t('gameOver.keptInMemory')}</p>
                <NeonButton variant="primary" onClick={() => void retrySubmit()} autoFocus>
                  {t('gameOver.retrySubmit')}
                </NeonButton>
              </>
            )}
          </>
        )}

        <div className={styles.actions}>
          <NeonButton variant={pending ? 'default' : 'primary'} onClick={playAgain} disabled={pending || starting}>
            {t('gameOver.playAgain')}
          </NeonButton>
          <NeonLink to="/select">{t('gameOver.changeCharacter')}</NeonLink>
          <NeonLink to="/">{t('app.home')}</NeonLink>
        </div>
      </Panel>
    </div>
  )
}
