import { describe, expect, it } from 'vitest'
import { STARTER_CHARACTERS, type WeaponId } from '@shared/types'
import {
  characters,
  cyberware,
  enemies,
  getWeapon,
  ripperdoc,
  ripperdocCost,
  skills,
  unlocks,
  waves,
  weapons,
} from './index'

const ids = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id))

describe('game data', () => {
  it('has 8 characters and the 3 starters', () => {
    expect(characters).toHaveLength(8)
    expect(characters.filter((c) => c.starter).map((c) => c.id)).toEqual([...STARTER_CHARACTERS])
  })

  it('references existing starting weapons and skills', () => {
    const weaponIds = ids(weapons)
    const skillIds = ids(skills)
    for (const c of characters) {
      expect(weaponIds.has(c.startingWeapon), c.id).toBe(true)
      expect(skillIds.has(c.skill), c.id).toBe(true)
    }
  })

  it('gives every weapon 8 levels with a positive cooldown', () => {
    for (const w of weapons) {
      expect(w.levels, w.id).toHaveLength(8)
      for (const l of w.levels) expect(l.cooldownSec, w.id).toBeGreaterThan(0)
    }
  })

  it('evolves weapons with existing cyberware', () => {
    const cyberIds = ids(cyberware)
    for (const w of weapons) expect(cyberIds.has(w.evolution.requires), w.id).toBe(true)
  })

  it('spawns only defined enemies', () => {
    const enemyIds = ids(enemies)
    for (const p of waves.phases) {
      for (const m of p.mix) expect(enemyIds.has(m.enemyId)).toBe(true)
      for (const s of p.specials) expect(enemyIds.has(s.enemyId)).toBe(true)
    }
  })

  it('has contiguous phases ending with an endless one', () => {
    const phases = waves.phases
    expect(phases[0].fromSec).toBe(0)
    for (let i = 1; i < phases.length; i++) expect(phases[i].fromSec).toBe(phases[i - 1].toSec)
    expect(phases[phases.length - 1].toSec).toBe(-1)
  })

  it('has exactly one unlock rule per non-starter character', () => {
    for (const c of characters.filter((x) => !x.starter)) {
      expect(unlocks.filter((u) => u.characterId === c.id), c.id).toHaveLength(1)
    }
    expect(unlocks).toHaveLength(5)
  })

  it('has the 12 Ripperdoc upgrades with the spec ranks', () => {
    const ranks = Object.fromEntries(ripperdoc.map((r) => [r.id, r.maxRank]))
    expect(ranks).toEqual({
      max_hp: 5, armor: 3, regen: 5, might: 5, speed: 3, area: 3,
      cooldown: 3, magnet: 3, luck: 3, growth: 5, revival: 1, greed: 5,
    })
  })

  it('throws on unknown ids', () => {
    expect(() => getWeapon('nope' as WeaponId)).toThrow('Unknown weapon: nope')
  })

  it('computes Ripperdoc cost growth', () => {
    const def = { ...ripperdoc[0], baseCost: 100, costGrowth: 1.5 }
    expect(ripperdocCost(def, 2)).toBe(225)
  })
})
