import { describe, expect, it } from 'vitest'
import { balance, getSkill } from '@data/index'
import { Cooldown, skillCooldown } from './cooldown'

describe('Cooldown', () => {
  it('triggers once, then waits the whole cooldown', () => {
    const c = new Cooldown(10)
    expect(c.ready()).toBe(true)
    expect(c.trigger()).toBe(true)
    expect(c.trigger()).toBe(false)
    c.tick(9.9)
    expect(c.trigger()).toBe(false)
    c.tick(0.1)
    expect(c.ready()).toBe(true)
    expect(c.trigger()).toBe(true)
  })

  it('reports progress and the share still to wait (HUD skillCooldown01)', () => {
    const c = new Cooldown(10)
    expect(c.remaining01).toBe(0)
    c.trigger()
    expect(c.remaining01).toBe(1)
    expect(c.progress01).toBe(0)
    c.tick(5)
    expect(c.progress01).toBeCloseTo(0.5)
    expect(c.remaining01).toBeCloseTo(0.5)
    c.tick(50)
    expect(c.remaining01).toBe(0)
    expect(c.progress01).toBe(1)
  })

  it('keeps the share still to wait when the cooldown length changes', () => {
    const c = new Cooldown(10)
    c.trigger()
    c.tick(5)
    c.setDuration(20)
    expect(c.remaining01).toBeCloseTo(0.5)
  })
})

describe('skillCooldown', () => {
  it('scales the skill cooldown by the cooldown stat', () => {
    const def = { ...getSkill('sandevistan'), cooldownSec: 20 }
    expect(skillCooldown(def, { ...balance.baseStats, cooldown: 0.85 })).toBeCloseTo(17)
  })
})
