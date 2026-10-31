import { describe, expect, it } from 'vitest'
import { balance } from '@data/index'
import { computeDamage, damageTaken, healAmount } from './combat'
import { createRng } from './rng'

const stats = (might: number, crit: number) => ({ ...balance.baseStats, might, crit })

describe('computeDamage', () => {
  it('scales by might and psychosis tiers', () => {
    const hit = computeDamage(10, stats(1.5, 0), { psychosis: 30, frenzy: false, rng: createRng(1) })
    expect(hit.amount).toBeCloseTo(15.45)
    expect(hit.crit).toBe(false)
  })

  it('doubles during frenzy', () => {
    const hit = computeDamage(10, stats(1.5, 0), { psychosis: 30, frenzy: true, rng: createRng(1) })
    expect(hit.amount).toBeCloseTo(30.9)
  })

  it('crits double the damage', () => {
    const hit = computeDamage(10, stats(1, 1), { psychosis: 0, frenzy: false, rng: createRng(1) })
    expect(hit).toEqual({ amount: 20, crit: true })
  })
})

describe('damageTaken', () => {
  it('never goes below 1', () => {
    expect(damageTaken(5, 10)).toBe(1)
    expect(damageTaken(12, 2)).toBe(10)
  })
})

describe('healAmount', () => {
  it('is reduced by psychosis tiers', () => {
    expect(healAmount(30, 50)).toBeCloseTo(28.5)
    expect(healAmount(30, 9)).toBe(30)
  })
})
