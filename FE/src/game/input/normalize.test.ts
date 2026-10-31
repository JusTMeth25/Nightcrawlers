import { describe, expect, it } from 'vitest'
import { emptyInput, type InputState } from './InputState'
import { applyDeadzone, mergeInput, normalize } from './normalize'

const state = (over: Partial<InputState>): InputState => ({ ...emptyInput(), ...over })

describe('applyDeadzone', () => {
  it('zeroes values inside the deadzone', () => {
    expect(applyDeadzone(0.2, 0)).toEqual([0, 0])
  })

  it('rescales the rest to 0-1', () => {
    expect(applyDeadzone(1, 0)).toEqual([1, 0])
    const [x, y] = applyDeadzone(0.625, 0)
    expect(x).toBeCloseTo(0.5)
    expect(y).toBe(0)
  })

  it('caps the length at 1', () => {
    const [x, y] = applyDeadzone(1, 1)
    expect(Math.hypot(x, y)).toBeCloseTo(1)
  })
})

describe('normalize', () => {
  it('returns a unit vector or zero', () => {
    const [x, y] = normalize(3, 4)
    expect(x).toBeCloseTo(0.6)
    expect(y).toBeCloseTo(0.8)
    expect(normalize(0, 0)).toEqual([0, 0])
  })
})

describe('mergeInput', () => {
  const kbm = state({ moveX: 1, aimX: 0, aimY: -1, aimActive: true })
  const touch = state({ moveY: 1 })

  it('falls back to a live source when the last one is gone (pad unplugged)', () => {
    const out = mergeInput([kbm, null, null], 'pad')
    expect(out.moveX).toBe(1)
    expect(out.aimActive).toBe(true)
  })

  it('takes movement from the last active source', () => {
    expect(mergeInput([kbm, touch, null], 'touch').moveY).toBe(1)
    expect(mergeInput([kbm, touch, null], 'touch').moveX).toBe(0)
  })

  it('ORs skill and pause across sources', () => {
    const out = mergeInput([kbm, state({ skill: true }), state({ pause: true })], 'kbm')
    expect(out.skill).toBe(true)
    expect(out.pause).toBe(true)
  })

  it('returns an idle state with no sources', () => {
    expect(mergeInput([null, null, null], 'kbm')).toEqual(emptyInput())
  })
})
