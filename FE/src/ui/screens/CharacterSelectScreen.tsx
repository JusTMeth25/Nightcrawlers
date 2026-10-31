import { useState } from 'react'
import { useNavigate } from 'react-router'
import { characters, getCharacter, getSkill, getWeapon } from '@data'
import type { CharacterId } from '@shared/types'
import { CharacterCard } from '../components/CharacterCard'
import { NeonButton, NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { characterState, formatModifier, progressText, unlockFor, unlockProgress } from '../meta/unlockProgress'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import styles from './Screens.module.css'

export default function CharacterSelectScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const status = useSession((s) => s.status)
  const save = useSession((s) => s.save)
  const previous = useRun((s) => s.characterId)
  const select = useRun((s) => s.select)
  const [selectedId, setSelectedId] = useState<CharacterId>(previous ?? 'david')

  const guest = status !== 'authenticated'
  const ownSave = guest ? null : save
  const selected = getCharacter(selectedId)
  const state = characterState(selected, ownSave)
  const unlock = unlockFor(selected.id)
  const progress = unlock && ownSave ? unlockProgress(unlock.rule, ownSave) : null

  const onStart = () => {
    if (state !== 'available') return
    select(selected.id)
    navigate('/play')
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
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </div>

        <section className={styles.details} aria-live="polite">
          <h3 className={styles.detailsTitle}>{selected.name}</h3>
          <dl className={styles.facts}>
            <dt>{t('select.weapon')}</dt>
            <dd>{getWeapon(selected.startingWeapon).name}</dd>
            <dt>{t('select.skill')}</dt>
            <dd>
              <strong>{getSkill(selected.skill).name}</strong>
              <span className={styles.muted}> — {getSkill(selected.skill).description}</span>
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
                  <span>{unlock.description}</span>
                  {progress && (
                    <span className={styles.progressRow}>
                      <progress
                        className={styles.progress}
                        aria-label={unlock.description}
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

        <div className={styles.actions}>
          <NeonButton variant="primary" onClick={onStart} disabled={state !== 'available'}>
            {t('select.start')}
          </NeonButton>
          <NeonLink to="/">{t('app.back')}</NeonLink>
        </div>
      </Panel>
    </div>
  )
}
