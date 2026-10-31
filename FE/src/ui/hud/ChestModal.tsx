import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { getWeapon } from '@data/index'
import { gameBus } from '@shared/events'
import type { ChestReward } from '@shared/types'
import { NeonButton } from '../components/NeonButton'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import { cardText, evolutionName } from './cardText'
import styles from './Overlay.module.css'

/** Chest opening: evolution (if any) or the reward cards; "Continua" emits 'chest:close'. */
export function ChestModal() {
  const [reward, setReward] = useState<ChestReward | null>(null)
  const closedRef = useRef(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const navRef = useGamepadNav({ enabled: reward !== null })

  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el
      navRef(el)
    },
    [navRef],
  )

  useEffect(
    () =>
      gameBus.on('chest:open', (r) => {
        closedRef.current = false
        setReward(r)
      }),
    [],
  )

  useEffect(() => {
    if (reward) containerRef.current?.querySelector<HTMLElement>('[data-nav]')?.focus()
  }, [reward])

  const onContinue = () => {
    if (closedRef.current) return
    closedRef.current = true
    setReward(null)
    gameBus.emit('chest:close', undefined)
  }

  if (!reward) return null

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={setContainer}>
        <div className={styles.crate} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {t('chest.title')}
        </h2>
        <div className={styles.reveal}>
          {reward.evolution && (
            <p className={styles.evolution}>
              <span className="visually-hidden">{t('chest.evolution')}: </span>
              {t('chest.evolutionText', {
                weapon: getWeapon(reward.evolution.weapon).name,
                into: evolutionName(reward.evolution.weapon, reward.evolution.into),
              })}
            </p>
          )}
          {reward.cards.length > 0 && (
            <ul className={styles.rewards} aria-label={t('chest.rewards')}>
              {reward.cards.map((card, i) => {
                const text = cardText(card)
                return (
                  <li key={i} className={styles.reward}>
                    <span className={styles.cardTitle}>{text.title}</span>
                    <span className={styles.cardSubtitle}>{text.subtitle}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <NeonButton variant="primary" onClick={onContinue}>
          {t('chest.continue')}
        </NeonButton>
      </div>
    </div>
  )
}
