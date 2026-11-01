import { useEffect, useState, type CSSProperties } from 'react'
import type { CharacterDef } from '@shared/types'
import { t } from '../i18n/it'
import { loadHeroFrames, portraitFrame, type AtlasRect } from '../meta/heroAtlas'
import type { CardState } from '../meta/unlockProgress'
import styles from './CharacterCard.module.css'

/**
 * Portrait from the hero atlas (frame <spriteKey>_down_idle_0 through background-position).
 * The inline values come from our own atlas and data files, never from user input, and React
 * applies them through CSSOM (allowed by a style-src 'self' CSP).
 */
export function Portrait({ character }: { character: CharacterDef }) {
  const [frame, setFrame] = useState<AtlasRect | null>(null)
  const key = character.spriteKey

  useEffect(() => {
    if (!key) return
    let alive = true
    void loadHeroFrames().then((frames) => {
      if (alive) setFrame(frames[portraitFrame(key)] ?? null)
    })
    return () => {
      alive = false
    }
  }, [key])

  const colorVar = { '--nc-char-color': character.color } as CSSProperties
  if (!key || !frame) {
    return <span className={styles.placeholder} style={colorVar} aria-hidden="true" data-testid="portrait-placeholder" />
  }
  return (
    <span className={styles.portraitBox} style={colorVar} aria-hidden="true">
      <span
        className={styles.portrait}
        style={{ width: frame.w, height: frame.h, backgroundPosition: `-${frame.x}px -${frame.y}px` }}
      />
    </span>
  )
}

export interface CharacterCardProps {
  character: CharacterDef
  state: CardState
  selected: boolean
  onSelect(): void
}

/** Selectable card of the character grid (navigable with the gamepad). */
export function CharacterCard({ character, state, selected, onSelect }: CharacterCardProps) {
  const encrypted = state === 'encrypted'
  const label =
    state === 'available' ? t('select.available') : encrypted ? t('select.encrypted') : t('select.locked')
  return (
    <button
      type="button"
      data-nav
      aria-pressed={selected}
      className={[styles.card, styles[state], selected && styles.selected].filter(Boolean).join(' ')}
      style={{ '--nc-char-color': character.color } as CSSProperties}
      onClick={onSelect}
      onFocus={onSelect}
    >
      <Portrait character={encrypted ? { ...character, spriteKey: null } : character} />
      <span className={styles.name}>{character.name}</span>
      <span className={styles.state}>{label}</span>
    </button>
  )
}
