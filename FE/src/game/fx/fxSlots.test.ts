import { describe, expect, it } from 'vitest'
import { FxSlots } from './fxSlots'

describe('FxSlots', () => {
  it('never hands a reserved (telegraph) slot to ordinary effects', () => {
    const slots = new FxSlots(8, 2)
    const t = slots.takeReserved()
    expect(t).toBeGreaterThanOrEqual(8)
    for (let i = 0; i < 1000; i++) {
      const s = slots.take()
      expect(s).toBeLessThan(8)
      expect(s).not.toBe(t)
    }
  })

  it('gives distinct reserved slots while they are held, and reuses released ones', () => {
    const slots = new FxSlots(4, 2)
    const a = slots.takeReserved()
    const b = slots.takeReserved()
    expect(a).not.toBe(b)
    expect(slots.takeReserved()).toBe(-1)
    slots.release(a)
    expect(slots.takeReserved()).toBe(a)
  })
})
