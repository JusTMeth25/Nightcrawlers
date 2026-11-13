import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ripperdoc, ripperdocCost } from '@data'
import type { RipperdocUpgradeId } from '@shared/types'
import { api } from '../../api'
import { isApiError } from '../../api/errors'
import { ErrorBanner } from '../components/ErrorBanner'
import { NeonButton, NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { Spinner } from '../components/Spinner'
import { apiErrorText } from '../i18n/apiErrorText'
import { ripperdocName } from '../i18n/dataText'
import { t } from '../i18n/it'
import { formatModifier } from '../meta/unlockProgress'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useSession } from '../store/session'
import styles from './Screens.module.css'

function buyErrorText(error: unknown): string {
  if (isApiError(error, 403)) return t('ripperdoc.notVerified')
  if (isApiError(error, 409) || isApiError(error, 404)) return error.problem?.title ?? t('error.generic')
  return apiErrorText(error)
}

/** Permanent upgrades. Guests see the shop disabled with an invite to register (spec 2.11). */
export default function RipperdocScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const status = useSession((s) => s.status)
  const user = useSession((s) => s.user)
  const save = useSession((s) => s.save)
  const setSave = useSession((s) => s.setSave)
  const reloadSave = useSession((s) => s.reloadSave)
  const [busy, setBusy] = useState<RipperdocUpgradeId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const registered = status === 'authenticated'
  const verified = registered && user?.emailVerified !== false
  const loading = registered && !save && !loadFailed

  useEffect(() => {
    if (!registered || save) return
    let alive = true
    reloadSave().catch(() => {
      if (alive) setLoadFailed(true)
    })
    return () => {
      alive = false
    }
  }, [registered, save, reloadSave, attempt])

  const buy = async (id: RipperdocUpgradeId, name: string) => {
    if (busy) return
    setBusy(id)
    setError(null)
    setNotice(null)
    try {
      const next = await api.buyRipperdoc(id)
      setSave(next)
      setNotice(t('ripperdoc.bought', { name, rank: next.ripperdoc[id] ?? 0 }))
    } catch (err) {
      setError(buyErrorText(err))
      // 409 = the local save was stale (€$ or rank changed elsewhere): show the server state
      if (isApiError(err, 409)) void reloadSave().catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const balance = save?.eurodollars ?? 0

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('ripperdoc.title')} wide>
        <p className={styles.muted}>{t('ripperdoc.intro')}</p>
        {!registered && (
          <>
            <ErrorBanner tone="info">{t('ripperdoc.guest')}</ErrorBanner>
            <NeonLink to="/register" variant="primary">
              {t('gameOver.register')}
            </NeonLink>
          </>
        )}
        {registered && !verified && <ErrorBanner tone="info">{t('ripperdoc.notVerified')}</ErrorBanner>}
        {loading && <Spinner />}
        {loadFailed && !save && (
          <>
            <ErrorBanner>{t('ripperdoc.loadFailed')}</ErrorBanner>
            <NeonButton
              onClick={() => {
                setLoadFailed(false)
                setAttempt((n) => n + 1)
              }}
            >{t('app.retry')}</NeonButton>
          </>
        )}
        {registered && save && <p className={styles.rowTitle}>{t('ripperdoc.balance', { amount: balance })}</p>}
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {notice && <ErrorBanner tone="info">{notice}</ErrorBanner>}

        {!loading && (
          <ul className={styles.list}>
            {ripperdoc.map((def) => {
              const rank = (registered ? save?.ripperdoc[def.id] : 0) ?? 0
              const maxed = rank >= def.maxRank
              const cost = ripperdocCost(def, rank)
              const canBuy = registered && verified && !!save && !maxed && balance >= cost && busy === null
              return (
                <li key={def.id} className={styles.row} aria-label={ripperdocName(def.id)}>
                  <div>
                    <div className={styles.rowTitle}>{ripperdocName(def.id)}</div>
                    <div>{t('ripperdoc.perRank', { effect: formatModifier(def.perRank) })}</div>
                    <div className={styles.muted}>{t('ripperdoc.rank', { rank, max: def.maxRank })}</div>
                  </div>
                  {maxed ? (
                    <NeonButton disabled>{t('ripperdoc.maxed')}</NeonButton>
                  ) : (
                    <NeonButton
                      variant="primary"
                      disabled={!canBuy}
                      aria-label={t('ripperdoc.buyLabel', { name: ripperdocName(def.id), cost })}
                      onClick={() => void buy(def.id, ripperdocName(def.id))}
                    >
                      {t('ripperdoc.buy', { cost })}
                    </NeonButton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <NeonLink to="/">{t('app.back')}</NeonLink>
      </Panel>
    </div>
  )
}
