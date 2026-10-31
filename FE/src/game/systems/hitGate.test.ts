import { describe, expect, it } from 'vitest'
import { HitGate } from './hitGate'

describe('HitGate', () => {
  it('lets an enemy be hit once per interval', () => {
    const gate = new HitGate(4)
    expect(gate.tryHit(2, 1, 0, 0.4)).toBe(true)
    expect(gate.tryHit(2, 1, 0.2, 0.4)).toBe(false)
    expect(gate.tryHit(2, 1, 0.4, 0.4)).toBe(true)
  })

  it('does not carry the cooldown to a new enemy spawned in the same slot', () => {
    const gate = new HitGate(4)
    expect(gate.tryHit(2, 1, 0, 0.4)).toBe(true)
    // slot 2 freed and reused: generation 2 is a different enemy
    expect(gate.tryHit(2, 2, 0.1, 0.4)).toBe(true)
    expect(gate.tryHit(2, 2, 0.2, 0.4)).toBe(false)
  })

  it('keeps slots independent', () => {
    const gate = new HitGate(4)
    expect(gate.tryHit(0, 1, 0, 1)).toBe(true)
    expect(gate.tryHit(1, 1, 0, 1)).toBe(true)
  })
})
