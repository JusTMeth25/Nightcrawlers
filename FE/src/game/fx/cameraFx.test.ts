import { describe, expect, it } from 'vitest'
import { createRng } from '../systems/rng'
import { FlashState, ShakeState } from './cameraFx'

describe('ShakeState', () => {
  it('offsets within the intensity and stops after its duration', () => {
    const s = new ShakeState(createRng(1))
    s.start(0.2, 6)
    s.update(0.05)
    expect(Math.abs(s.x)).toBeLessThanOrEqual(6)
    expect(Math.abs(s.y)).toBeLessThanOrEqual(6)
    expect(s.active).toBe(true)
    s.update(0.2)
    expect(s.active).toBe(false)
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
  })

  it('does not move without updates (frozen while the game is paused)', () => {
    const s = new ShakeState(createRng(1))
    s.start(0.2, 6)
    s.update(0.05)
    const x = s.x
    expect(s.x).toBe(x)
    expect(s.active).toBe(true)
  })

  it('a weaker shake does not cut a stronger one short', () => {
    const s = new ShakeState(createRng(1))
    s.start(0.5, 8)
    s.start(0.1, 2)
    s.update(0.2)
    expect(s.active).toBe(true)
  })
})

describe('FlashState', () => {
  it('fades linearly from full to zero', () => {
    const f = new FlashState()
    f.start(0.2, 0xff0000)
    expect(f.alpha).toBeCloseTo(1)
    f.update(0.1)
    expect(f.alpha).toBeCloseTo(0.5)
    expect(f.color).toBe(0xff0000)
    f.update(0.2)
    expect(f.alpha).toBe(0)
  })
})
