import { describe, expect, it } from 'vitest'
import { inReservedZone, STICK_RADIUS, touchButtons, VirtualStick } from './TouchInput'

describe('VirtualStick', () => {
  it('follows only its own pointer and clamps the knob', () => {
    const stick = new VirtualStick()
    stick.start(1, 100, 100)
    stick.move(2, 400, 100)
    expect(stick.vector()).toEqual([0, 0])
    stick.move(1, 100 + STICK_RADIUS * 3, 100)
    expect(stick.vector()).toEqual([1, 0])
    stick.end(1)
    expect(stick.active).toBe(false)
    expect(stick.vector()).toEqual([0, 0])
  })
})

describe('touch layout', () => {
  it('keeps the buttons inside the reserved zone', () => {
    for (const b of touchButtons(800)) expect(inReservedZone(b.x, b.y, 800)).toBe(true)
    expect(inReservedZone(400, 300, 800)).toBe(false)
  })
})
