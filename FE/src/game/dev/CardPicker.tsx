// Harness-only stand-in for the UI modals: logs bus events and answers level-ups and chests.
import { useEffect, useState } from 'react'
import { gameBus } from '@shared/events'
import type { ChestReward, LevelUpCard } from '@shared/types'

const label = (c: LevelUpCard) => ('id' in c ? `${c.kind} ${c.id}${'level' in c ? ` L${c.level}` : ''}` : `${c.kind} ${c.amount}`)

const box: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  background: '#0c0b14ee',
  border: '1px solid #05d9e8',
  color: '#d1f7ff',
  fontFamily: 'monospace',
  zIndex: 10,
}

/** `auto`: answer every level-up with the first card and close chests at once (long runs). */
export default function CardPicker({ auto = false }: { auto?: boolean }) {
  const [cards, setCards] = useState<LevelUpCard[] | null>(null)
  const [chest, setChest] = useState<ChestReward | null>(null)

  useEffect(() => {
    const offs = [
      gameBus.on('levelup:offer', ({ cards }) => {
        console.info('[harness] levelup:offer', cards)
        if (auto) queueMicrotask(() => gameBus.emit('levelup:choose', { index: 0 }))
        else setCards(cards)
      }),
      gameBus.on('chest:open', (reward) => {
        console.info('[harness] chest:open', reward)
        if (auto) queueMicrotask(() => gameBus.emit('chest:close', undefined))
        else setChest(reward)
      }),
      gameBus.on('game:paused', (p) => console.info('[harness] game:paused', p.reason)),
      gameBus.on('game:resumed', () => console.info('[harness] game:resumed')),
    ]
    return () => offs.forEach((off) => off())
  }, [auto])

  if (cards) {
    return (
      <div style={box}>
        <strong>Level up</strong>
        {cards.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setCards(null)
              gameBus.emit('levelup:choose', { index: i })
            }}
          >
            {label(c)}
          </button>
        ))}
      </div>
    )
  }
  if (chest) {
    return (
      <div style={box}>
        <strong>Chest</strong>
        {chest.evolution ? <span>evolution: {chest.evolution.into}</span> : chest.cards.map((c, i) => <span key={i}>{label(c)}</span>)}
        <button
          type="button"
          onClick={() => {
            setChest(null)
            gameBus.emit('chest:close', undefined)
          }}
        >
          Close
        </button>
      </div>
    )
  }
  return null
}
