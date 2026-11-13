import { unlocks } from '@data'
import type { SaveDto } from '@shared/api-contract'
import type { CharacterDef, CharacterId, StatModifier, UnlockDef, UnlockRule } from '@shared/types'
import { formatTime } from '../hud/format'
import { t, type TextKey } from '../i18n/it'
import { getLocale } from '../i18n/locale'
import { formatNumber } from '../i18n/number'

export type CardState = 'available' | 'locked' | 'encrypted'

/**
 * Guest (save null): only the starters. A character without sprite is 'encrypted' even when
 * unlocked: its rule exists but it cannot be picked until the sprite is in the atlas.
 */
export function characterState(c: CharacterDef, save: SaveDto | null): CardState {
  if (c.spriteKey === null) return 'encrypted'
  if (c.starter) return 'available'
  return save?.unlockedCharacters.includes(c.id) ? 'available' : 'locked'
}

export function unlockFor(id: CharacterId): UnlockDef | null {
  return unlocks.find((u) => u.characterId === id) ?? null
}

function raw(rule: UnlockRule, save: SaveDto): { current: number; target: number } {
  switch (rule.type) {
    case 'survive':
      return { current: save.bestTimeSec, target: rule.seconds }
    case 'kills':
      return { current: save.killStats[rule.enemyId] ?? 0, target: rule.count }
    case 'eurodollars_total':
      return { current: save.totalEurodollarsEarned, target: rule.amount }
    case 'survive_with':
      return { current: save.characterStats[rule.characterId]?.bestTimeSec ?? 0, target: rule.seconds }
    case 'distinct_characters':
      return {
        current: Object.values(save.characterStats).filter((s) => s && s.bestTimeSec >= rule.seconds).length,
        target: rule.count,
      }
  }
}

/** Progress towards an unlock rule, capped at the target. */
export function unlockProgress(rule: UnlockRule, save: SaveDto): { current: number; target: number } {
  const { current, target } = raw(rule, save)
  return { current: Math.min(Math.max(0, current), target), target }
}

/** Progress values as text: times as mm:ss, the rest as numbers. */
export function progressText(rule: UnlockRule, p: { current: number; target: number }): string {
  const timed = rule.type === 'survive' || rule.type === 'survive_with'
  const fmt = (n: number) => (timed ? formatTime(n) : formatNumber(n))
  return t('select.progress', { current: fmt(p.current), target: fmt(p.target) })
}

function number(n: number) {
  return n.toLocaleString(getLocale(), { maximumFractionDigits: 2 })
}

/** '+10% velocità', '-10 PV max', '+0,1 rigenerazione PV/s'. */
export function formatModifier(m: StatModifier): string {
  const value = m.op === 'mul' ? Math.round(m.value * 1000) / 10 : m.value
  const sign = value >= 0 ? '+' : '-'
  const unit = m.op === 'mul' ? '%' : ''
  return `${sign}${number(Math.abs(value))}${unit} ${t(`stat.${m.stat}` as TextKey)}`
}
