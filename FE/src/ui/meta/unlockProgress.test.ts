import { afterEach, describe, expect, it } from 'vitest'
import { getCharacter } from '@data'
import type { SaveDto } from '@shared/api-contract'
import { setLocale } from '../i18n/locale'
import { characterState, formatModifier, progressText, unlockFor, unlockProgress } from './unlockProgress'

afterEach(() => setLocale('it'))

function save(patch: Partial<SaveDto> = {}): SaveDto {
  return {
    eurodollars: 0,
    totalEurodollarsEarned: 0,
    totalKills: 0,
    bestTimeSec: 0,
    unlockedCharacters: ['david', 'lucy', 'rebecca'],
    ripperdoc: {},
    killStats: {},
    characterStats: {},
    codex: { enemies: [], weapons: [] },
    ...patch,
  }
}

describe('characterState', () => {
  it('guest: only the starters are available', () => {
    expect(characterState(getCharacter('david'), null)).toBe('available')
    expect(characterState(getCharacter('lucy'), null)).toBe('available')
    expect(characterState(getCharacter('rebecca'), null)).toBe('available')
    expect(characterState(getCharacter('maine'), null)).toBe('locked')
  })

  it('a save with maine unlocked makes maine available', () => {
    expect(characterState(getCharacter('maine'), save())).toBe('locked')
    expect(characterState(getCharacter('maine'), save({ unlockedCharacters: ['david', 'maine'] }))).toBe('available')
  })

  it('a character without sprite is encrypted even when unlocked', () => {
    const s = save({ unlockedCharacters: ['david', 'lucy', 'rebecca', 'kiwi'] })
    // every shipped character has a sprite now: a future one without art stays encrypted
    const noArt = { ...getCharacter('kiwi'), spriteKey: null }
    expect(characterState(noArt, s)).toBe('encrypted')
    expect(characterState(noArt, null)).toBe('encrypted')
    expect(characterState(getCharacter('kiwi'), s)).toBe('available')
  })
})

describe('unlockProgress', () => {
  it('kills of an enemy come from killStats', () => {
    expect(unlockProgress({ type: 'kills', enemyId: 'maxtac', count: 50 }, save({ killStats: { maxtac: 12 } }))).toEqual({
      current: 12,
      target: 50,
    })
  })

  it('distinct_characters counts characters whose best time reaches the threshold', () => {
    const s = save({
      characterStats: {
        david: { bestTimeSec: 950, runs: 3 },
        lucy: { bestTimeSec: 900, runs: 1 },
        rebecca: { bestTimeSec: 899, runs: 1 },
      },
    })
    expect(unlockProgress({ type: 'distinct_characters', count: 3, seconds: 900 }, s)).toEqual({ current: 2, target: 3 })
  })

  it('covers survive, eurodollars_total and survive_with, capped at the target', () => {
    const s = save({
      bestTimeSec: 700,
      totalEurodollarsEarned: 1200,
      characterStats: { maine: { bestTimeSec: 300, runs: 1 } },
    })
    expect(unlockProgress({ type: 'survive', seconds: 600 }, s)).toEqual({ current: 600, target: 600 })
    expect(unlockProgress({ type: 'eurodollars_total', amount: 5000 }, s)).toEqual({ current: 1200, target: 5000 })
    expect(unlockProgress({ type: 'survive_with', characterId: 'maine', seconds: 1800 }, s)).toEqual({
      current: 300,
      target: 1800,
    })
  })

  it('finds the unlock rule of a character (none for starters)', () => {
    expect(unlockFor('david')).toBeNull()
    expect(unlockFor('kiwi')?.rule).toEqual({ type: 'kills', enemyId: 'maxtac', count: 50 })
  })
})

describe('progressText', () => {
  it('groups thousands in every language', () => {
    const rule = unlockFor('pilar')!.rule
    const p = unlockProgress(rule, save({ totalEurodollarsEarned: 1234 }))
    expect(progressText(rule, p)).toBe('Avanzamento: 1.234 / 5.000')
    setLocale('en')
    expect(progressText(rule, p)).toBe('Progress: 1,234 / 5,000')
    setLocale('es')
    expect(progressText(rule, p)).toBe('Progreso: 1.234 / 5.000')
  })
})

describe('formatModifier', () => {
  it('formats percentages and flat values with a sign', () => {
    expect(formatModifier({ stat: 'speed', op: 'mul', value: 0.1 })).toBe('+10% velocità')
    expect(formatModifier({ stat: 'maxHp', op: 'add', value: -10 })).toBe('-10 PV max')
    expect(formatModifier({ stat: 'regen', op: 'add', value: 0.1 })).toBe('+0,1 rigenerazione PV/s')
  })
})
