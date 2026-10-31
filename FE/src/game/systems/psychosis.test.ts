import { describe, expect, it } from 'vitest'
import { createPsychosis, isFrenzy, onKill, tick, type PsychosisState } from './psychosis'

const kills = (s: PsychosisState, n: number, levels: number) => {
  for (let i = 0; i < n; i++) s = onKill(s, levels)
  return s
}

describe('psychosis', () => {
  it('adds perKill x cyber levels per kill', () => {
    expect(onKill(createPsychosis(), 10).value).toBeCloseTo(0.5)
  })

  it('enters frenzy at 100 and resets the bar', () => {
    const s = kills(createPsychosis(), 200, 10)
    expect(isFrenzy(s)).toBe(true)
    expect(s.value).toBe(0)
    expect(s.frenzyLeftSec).toBe(10)
  })

  it('does not accumulate during frenzy', () => {
    const s = kills(kills(createPsychosis(), 200, 10), 50, 10)
    expect(s.value).toBe(0)
  })

  it('ends frenzy after its duration', () => {
    let s = kills(createPsychosis(), 200, 10)
    s = tick(s, 9.9)
    expect(isFrenzy(s)).toBe(true)
    s = tick(s, 0.1)
    expect(isFrenzy(s)).toBe(false)
  })

  it('stays at 0 without cyberware', () => {
    expect(kills(createPsychosis(), 500, 0).value).toBe(0)
  })
})
