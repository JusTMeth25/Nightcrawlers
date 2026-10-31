import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { gameBus } from '@shared/events'
import type { LevelUpCard } from '@shared/types'
import { t } from '../i18n/it'
import { moveFocus, type NavDirection } from '../nav/focus'
import { useGamepadNav } from '../nav/useGamepadNav'
import { cardBadge, cardText } from './cardText'
import styles from './Overlay.module.css'

const ARROWS: Record<string, NavDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * Level-up choice. Mouse, keyboard (arrows + Enter, keys 1-4) and gamepad (D-pad/stick + A).
 * 'levelup:choose' is emitted once per offer; input is ignored for armDelayMs after opening
 * so that a key or button held for the game does not pick a card by accident.
 */
export function LevelUpModal({ armDelayMs = 300 }: { armDelayMs?: number }) {
  const [cards, setCards] = useState<LevelUpCard[] | null>(null)
  const cardsRef = useRef<LevelUpCard[] | null>(null)
  const chosenRef = useRef(true)
  const openedAtRef = useRef(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const navRef = useGamepadNav({ enabled: cards !== null })

  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el
      navRef(el)
    },
    [navRef],
  )

  useEffect(
    () =>
      gameBus.on('levelup:offer', (offer) => {
        chosenRef.current = false
        openedAtRef.current = Date.now()
        cardsRef.current = offer.cards
        setCards(offer.cards)
      }),
    [],
  )

  const choose = useCallback(
    (index: number) => {
      const current = cardsRef.current
      if (chosenRef.current || !current || index < 0 || index >= current.length) return
      if (Date.now() - openedAtRef.current < armDelayMs) return
      chosenRef.current = true
      cardsRef.current = null
      setCards(null)
      gameBus.emit('levelup:choose', { index })
    },
    [armDelayMs],
  )

  useEffect(() => {
    if (!cards) return
    containerRef.current?.querySelector<HTMLElement>('[data-nav]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault()
        if (!e.repeat) choose(Number(e.key) - 1)
        return
      }
      const dir = ARROWS[e.key]
      if (dir && containerRef.current) {
        e.preventDefault()
        moveFocus(containerRef.current, dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards, choose])

  if (!cards) return null

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={setContainer}>
        <h2 id={titleId} className={styles.title}>
          {t('levelup.title')}
        </h2>
        <p className={styles.subtitle}>{t('levelup.subtitle')}</p>
        <div className={styles.cards}>
          {cards.map((card, i) => {
            const text = cardText(card)
            const badge = cardBadge(card)
            return (
              <button key={i} type="button" data-nav className={styles.card} onClick={() => choose(i)}>
                <span className={styles.cardKey} aria-hidden="true">
                  {i + 1}
                </span>
                {badge && <span className={styles.cardBadge}>{badge}</span>}
                <span className={styles.cardTitle}>{text.title}</span>
                <span className={styles.cardSubtitle}>{text.subtitle}</span>
              </button>
            )
          })}
        </div>
        <p className={styles.hint}>{t('levelup.hint', { count: cards.length })}</p>
      </div>
    </div>
  )
}
