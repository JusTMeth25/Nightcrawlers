import { describe, expect, it } from 'vitest'
import { balance } from '@data/index'
import { BossBrain, bossHp, bossPatternsFor, TELEGRAPH_SEC } from './bossPatterns'

describe('bossPatternsFor', () => {
  it('starts with one pattern and adds one per return, up to the maximum', () => {
    expect(bossPatternsFor(0)).toHaveLength(1)
    expect(bossPatternsFor(1)).toHaveLength(2)
    expect(bossPatternsFor(5)).toHaveLength(balance.boss.maxPatterns)
    expect(new Set(bossPatternsFor(5)).size).toBe(4)
  })
})

describe('bossHp', () => {
  it('grows by hpGrowth per return', () => {
    expect(bossHp(4000, 2, 0)).toBeCloseTo(9000)
  })

  it('applies the MaxTac alert multiplier', () => {
    expect(bossHp(4000, 0, 1860)).toBeCloseTo(4000 * 1.03)
  })
})

describe('BossBrain', () => {
  it('telegraphs for 0.8 s before every attack, then cycles the patterns', () => {
    const brain = new BossBrain(bossPatternsFor(1))
    const started: string[] = []
    let t = 0
    const step = 1 / 60
    let telegraphAt = -1
    let attackAt = -1
    while (t < 20 && started.length < 2) {
      const ev = brain.update(step)
      t += step
      if (ev === 'telegraph' && telegraphAt < 0) telegraphAt = t
      if (ev === 'attack') {
        if (attackAt < 0) attackAt = t
        started.push(brain.pattern)
      }
    }
    expect(attackAt - telegraphAt).toBeCloseTo(TELEGRAPH_SEC, 1)
    expect(started).toEqual(['coneBlast', 'charge'])
  })

  it('is chasing between attacks', () => {
    const brain = new BossBrain(['coneBlast'])
    expect(brain.phase).toBe('chase')
  })
})
