import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { characters, getCharacter } from '@data'
import type { CharacterId } from '@shared/types'
import { CharacterCard } from '../components/CharacterCard'
import { ErrorBanner } from '../components/ErrorBanner'
import { NeonButton, NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { skillDescription, skillName, unlockText, weaponName } from '../i18n/dataText'
import { t } from '../i18n/it'
import { characterState, formatModifier, progressText, unlockFor, unlockProgress } from '../meta/unlockProgress'
import { useGamepadNav } from '../nav/useGamepadNav'
import { hasUnsentResult, useRun } from '../store/run'
import { useSession } from '../store/session'
import styles from './Screens.module.css'

export default function CharacterSelectScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const status = useSession((s) => s.status)
  const save = useSession((s) => s.save)
  const previous = useRun((s) => s.characterId)
  const select = useRun((s) => s.select)
  const start = useRun((s) => s.start)
  const startGuest = useRun((s) => s.startGuest)
  const startError = useRun((s) => s.startError)
  const unsent = useRun(hasUnsentResult)
  const retrySubmit = useRun((s) => s.retrySubmit)
  const submitting = useRun((s) => s.submitting)
  const location = useLocation()
  const [selectedId, setSelectedId] = useState<CharacterId>(previous ?? 'david')
  const [phase, setPhase] = useState<'idle' | 'starting' | 'needs_verification'>(() =>
    (location.state as { needsVerification?: boolean } | null)?.needsVerification ? 'needs_verification' : 'idle',
  )

  const guest = status !== 'authenticated'
  const ownSave = guest ? null : save
  const selected = getCharacter(selectedId)
  const state = characterState(selected, ownSave)
  const unlock = unlockFor(selected.id)
  const progress = unlock && ownSave ? unlockProgress(unlock.rule, ownSave) : null

  const onStart = async () => {
    if (state !== 'available' || phase === 'starting' || unsent) return
    select(selected.id)
    setPhase('starting')
    const res = await start()
    if (res === 'started') navigate('/play')
    else setPhase(res === 'needs_verification' ? res : 'idle')
  }

  const onGuestRun = () => {
    if (startGuest() === 'started') navigate('/play')
  }

  const pick = (id: CharacterId) => {
    setSelectedId(id)
    if (phase !== 'starting') setPhase('idle')
  }

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('select.title')} wide>
        <div className={styles.characterGrid}>
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              state={characterState(c, ownSave)}
              selected={c.id === selectedId}
              onSelect={() => pick(c.id)}
            />
          ))}
        </div>

        <section className={styles.details} aria-live="polite">
          <h3 className={styles.detailsTitle}>{selected.name}</h3>
          <dl className={styles.facts}>
            <dt>{t('select.weapon')}</dt>
            <dd>{weaponName(selected.startingWeapon)}</dd>
            <dt>{t('select.skill')}</dt>
            <dd>
              <strong>{skillName(selected.skill)}</strong>
              <span className={styles.muted}> — {skillDescription(selected.skill)}</span>
            </dd>
            <dt>{t('select.bonus')}</dt>
            <dd>
              <ul className={styles.inlineList}>
                {selected.passive.map((m) => (
                  <li key={`${m.stat}-${m.op}`}>{formatModifier(m)}</li>
                ))}
              </ul>
            </dd>
            {unlock && (
              <>
                <dt>{t('select.requirement')}</dt>
                <dd>
                  <span>{unlockText(selected.id)}</span>
                  {progress && (
                    <span className={styles.progressRow}>
                      <progress
                        className={styles.progress}
                        aria-label={unlockText(selected.id)}
                        value={progress.current}
                        max={progress.target}
                        aria-valuenow={progress.current}
                        aria-valuemin={0}
                        aria-valuemax={progress.target}
                      />
                      <span className={styles.muted}>{progressText(unlock.rule, progress)}</span>
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
          {state === 'encrypted' && <p className={styles.warning}>{t('select.encryptedHint')}</p>}
          {state === 'locked' && guest && <p className={styles.muted}>{t('select.guestLocked')}</p>}
        </section>

        {phase === 'needs_verification' && (
          <div className={styles.details} role="status">
            <p>{t('select.needsVerification')}</p>
            <div className={styles.actions}>
              <NeonButton variant="primary" onClick={onGuestRun} disabled={!selected.starter}>
                {t('select.playAsGuest')}
              </NeonButton>
            </div>
            {!selected.starter && <p className={styles.muted}>{t('select.guestStartersOnly')}</p>}
          </div>
        )}
        {unsent && (
          <div className={styles.details} role="status">
            <p className={styles.warning}>{t('select.unsentResult')}</p>
            <div className={styles.actions}>
              <NeonButton variant="primary" onClick={() => void retrySubmit()} disabled={submitting}>
                {t('gameOver.retrySubmit')}
              </NeonButton>
              <NeonLink to="/game-over">{t('select.openResult')}</NeonLink>
            </div>
          </div>
        )}
        {startError && <ErrorBanner>{startError}</ErrorBanner>}

        <div className={styles.actions}>
          <NeonButton
            variant="primary"
            onClick={() => void onStart()}
            disabled={state !== 'available' || phase === 'starting' || unsent}
          >
            {phase === 'starting' ? t('select.starting') : t('select.start')}
          </NeonButton>
          <NeonLink to="/">{t('app.back')}</NeonLink>
        </div>
      </Panel>
    </div>
  )
}
