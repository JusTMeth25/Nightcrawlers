import { describe, expect, it } from 'vitest'
import { balance, getWeapon } from '@data/index'
import type { Inventory } from './inventory'
import { createRng } from './rng'
import { applyEvolution, chestReward, evolvable, weaponStats } from './weapons'

const stats = { ...balance.baseStats }

describe('weaponStats', () => {
  it('scales cooldown by the cooldown stat', () => {
    const s = weaponStats({ id: 'pistol', level: 1, evolved: false }, { ...stats, cooldown: 0.92 })
    expect(s.cooldownSec).toBeCloseTo(0.552)
  })

  it('applies area, duration and projectile speed but not projectiles', () => {
    const s = weaponStats(
      { id: 'pistol', level: 4, evolved: false },
      { ...stats, area: 1.5, duration: 2, projectileSpeed: 1.1 },
    )
    const base = getWeapon('pistol').levels[3]
    expect(s.area).toBeCloseTo(base.area * 1.5)
    expect(s.durationSec).toBeCloseTo(base.durationSec * 2)
    expect(s.speed).toBeCloseTo(base.speed * 1.1)
    expect(s.projectiles).toBe(base.projectiles)
  })

  it('uses the evolution stats once evolved', () => {
    expect(weaponStats({ id: 'pistol', level: 8, evolved: true }, stats).damage).toBe(getWeapon('pistol').evolution.stats.damage)
  })
})

const maxPistol: Inventory = {
  weapons: [{ id: 'pistol', level: 8, evolved: false }],
  cyberware: [{ id: 'kerenzikov', level: 1 }],
}

describe('evolutions', () => {
  it('needs level 8 and the required cyberware', () => {
    expect(evolvable(maxPistol)).toEqual(['pistol'])
    expect(evolvable({ ...maxPistol, cyberware: [] })).toEqual([])
    expect(evolvable({ ...maxPistol, weapons: [{ id: 'pistol', level: 7, evolved: false }] })).toEqual([])
  })

  it('chest gives the evolution first', () => {
    expect(chestReward(maxPistol, createRng(1), 1)).toEqual({
      cards: [],
      evolution: { weapon: 'pistol', into: getWeapon('pistol').evolution.id },
    })
  })

  it('chest gives 1-3 legal cards otherwise', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = chestReward({ weapons: [{ id: 'pistol', level: 1, evolved: false }], cyberware: [] }, createRng(seed), 1)
      expect(r.evolution).toBeNull()
      expect(r.cards.length).toBeGreaterThanOrEqual(1)
      expect(r.cards.length).toBeLessThanOrEqual(3)
      for (const c of r.cards) expect(['heal', 'eurodollars']).not.toContain(c.kind)
    }
  })

  it('applyEvolution marks the weapon evolved', () => {
    expect(applyEvolution(maxPistol, 'pistol').weapons[0]).toEqual({ id: 'pistol', level: 8, evolved: true })
    expect(evolvable(applyEvolution(maxPistol, 'pistol'))).toEqual([])
  })
})
