import { describe, expect, it } from 'vitest'
import { cyberware, weapons } from '@data/index'
import type { LevelUpCard } from '@shared/types'
import { createInventory, type Inventory } from './inventory'
import { generateOffers, LevelUpQueue } from './levelup'
import { createRng } from './rng'

const key = (c: LevelUpCard) => `${c.kind}:${'id' in c ? c.id : ''}`

describe('generateOffers', () => {
  it('returns 3 distinct cards', () => {
    const cards = generateOffers(createInventory('pistol'), createRng(3), 1)
    expect(cards).toHaveLength(3)
    expect(new Set(cards.map(key)).size).toBe(3)
  })

  it('does not offer new weapons with 6 weapons', () => {
    const inv: Inventory = {
      weapons: weapons.slice(0, 6).map((w) => ({ id: w.id, level: 1, evolved: false })),
      cyberware: [],
    }
    for (let seed = 0; seed < 30; seed++) {
      expect(generateOffers(inv, createRng(seed), 1).some((c) => c.kind === 'weapon_new')).toBe(false)
    }
  })

  it('falls back to heal and eurodollars when everything is maxed', () => {
    const inv: Inventory = {
      weapons: weapons.slice(0, 6).map((w) => ({ id: w.id, level: 8, evolved: false })),
      cyberware: cyberware.slice(0, 6).map((c) => ({ id: c.id, level: 5 })),
    }
    expect(generateOffers(inv, createRng(1), 1)).toEqual([
      { kind: 'heal', amount: 30 },
      { kind: 'eurodollars', amount: 25 },
    ])
  })

  it('is deterministic for a seed', () => {
    const inv = createInventory('shotgun')
    expect(generateOffers(inv, createRng(77), 1)).toEqual(generateOffers(inv, createRng(77), 1))
  })

  it('offers the next level for upgrades', () => {
    const inv: Inventory = { weapons: [{ id: 'pistol', level: 3, evolved: false }], cyberware: [] }
    let seen = 0
    for (let seed = 0; seed < 20; seed++) {
      const up = generateOffers(inv, createRng(seed), 1, 3, ['pistol']).find((c) => c.kind === 'weapon_up')
      if (!up) continue
      seen++
      expect(up).toEqual({ kind: 'weapon_up', id: 'pistol', level: 4 })
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('can add a 4th card with luck above 1', () => {
    const counts = new Set<number>()
    for (let seed = 0; seed < 40; seed++) counts.add(generateOffers(createInventory('pistol'), createRng(seed), 1.9).length)
    expect(counts.has(4)).toBe(true)
  })

  it('restricts new weapons to the given pool', () => {
    for (let seed = 0; seed < 30; seed++) {
      const cards = generateOffers(createInventory('pistol'), createRng(seed), 1, 3, ['pistol', 'shotgun'])
      for (const c of cards) if (c.kind === 'weapon_new') expect(c.id).toBe('shotgun')
    }
  })
})

describe('LevelUpQueue', () => {
  it('hands out queued levels one at a time', () => {
    const q = new LevelUpQueue()
    q.push(3)
    expect(q.pending).toBe(3)
    expect([q.next(), q.next(), q.next(), q.next()]).toEqual([true, true, true, false])
    expect(q.pending).toBe(0)
  })
})
