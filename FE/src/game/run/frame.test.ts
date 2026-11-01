import { describe, expect, it } from 'vitest'
import { clampDeltaSec, MAX_FRAME_MS, stepFrame, type FrameHost, runSteps } from './frame'

function host(over: Partial<FrameHost> = {}) {
  const calls: string[] = []
  let clock = 0
  let paused = false
  const h: FrameHost & { calls: string[]; clock: () => number; setPaused(p: boolean): void } = {
    calls,
    clock: () => clock,
    setPaused: (p) => {
      paused = p
    },
    isPaused: () => paused,
    advanceClock: (dt) => {
      clock += dt
    },
    simulate: () => calls.push('simulate'),
    resolveDamage: () => calls.push('damage'),
    ...over,
  }
  return h
}

describe('clampDeltaSec', () => {
  it('caps a background-tab delta at 100 ms', () => {
    expect(MAX_FRAME_MS).toBe(100)
    expect(clampDeltaSec(5000)).toBeCloseTo(0.1)
    expect(clampDeltaSec(16)).toBeCloseTo(0.016)
    expect(clampDeltaSec(-5)).toBe(0)
  })
})

describe('stepFrame', () => {
  it('advances the clock by the clamped delta', () => {
    const h = host()
    stepFrame(5000, h)
    expect(h.clock()).toBeCloseTo(0.1)
    expect(h.calls).toEqual(['simulate', 'damage'])
  })

  it('freezes the clock and the world while paused', () => {
    const h = host()
    h.setPaused(true)
    expect(stepFrame(16, h)).toBe(false)
    expect(h.clock()).toBe(0)
    expect(h.calls).toEqual([])
  })

  it('skips player damage when the simulation opened a level-up this frame', () => {
    const h = host()
    h.simulate = () => {
      h.calls.push('simulate')
      h.setPaused(true)
    }
    stepFrame(16, h)
    expect(h.calls).toEqual(['simulate'])
  })
})

describe('runSteps', () => {
  it('stops before the next step once the player died (no level-up during death)', () => {
    let dead = false
    const ran: string[] = []
    const steps = [
      () => ran.push('move'),
      () => {
        ran.push('boss')
        dead = true
      },
      () => ran.push('pickups'),
    ]
    runSteps(steps, 0.016, () => dead)
    expect(ran).toEqual(['move', 'boss'])
  })

  it('runs every step while nothing stops it', () => {
    const ran: number[] = []
    runSteps([(dt) => ran.push(dt), (dt) => ran.push(dt * 2)], 1, () => false)
    expect(ran).toEqual([1, 2])
  })
})
