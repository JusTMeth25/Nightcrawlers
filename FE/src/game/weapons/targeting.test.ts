import { describe, expect, it } from 'vitest'
import { emptyInput } from '../input/InputState'
import { aimDirection, spreadAngles } from './targeting'

const player = { x: 100, y: 100 }
const left = { x: -1, y: 0 }

describe('aimDirection', () => {
  it('aim follows the active aim', () => {
    const input = { ...emptyInput(), aimX: 1, aimY: 0, aimActive: true }
    expect(aimDirection('aim', input, player, { x: 100, y: 0 }, left)).toEqual({ x: 1, y: 0 })
  })

  it('aim falls back to the nearest enemy, then to the last movement', () => {
    const d = aimDirection('aim', emptyInput(), player, { x: 100, y: 40 }, left)
    expect(d?.x).toBeCloseTo(0)
    expect(d?.y).toBeCloseTo(-1)
    expect(aimDirection('aim', emptyInput(), player, null, left)).toEqual({ x: -1, y: 0 })
  })

  it('nearest needs a target', () => {
    expect(aimDirection('nearest', emptyInput(), player, null, left)).toBeNull()
    expect(aimDirection('nearest', emptyInput(), player, { x: 200, y: 100 }, left)).toEqual({ x: 1, y: 0 })
  })

  it('area ignores aim', () => {
    expect(aimDirection('area', { ...emptyInput(), aimActive: true, aimX: 1 }, player, null, left)).toBeNull()
  })
})

describe('spreadAngles', () => {
  it('centres n angles on the base direction', () => {
    expect(spreadAngles(0, 1, 8)).toEqual([0])
    const three = spreadAngles(0, 3, 8)
    expect(three[1]).toBeCloseTo(0)
    expect(three[2] - three[0]).toBeCloseTo((16 * Math.PI) / 180)
  })
})

describe('allocation-free variants', () => {
  it('aimDirection writes into the given vector', () => {
    const out = { x: 0, y: 0 }
    const input = { ...emptyInput(), aimX: 0, aimY: 2, aimActive: true }
    expect(aimDirection('aim', input, player, null, left, out)).toBe(out)
    expect(out).toEqual({ x: 0, y: 1 })
    expect(aimDirection('nearest', input, player, null, left, out)).toBeNull()
  })

  it('spreadAngles fills and returns the given array', () => {
    const out: number[] = [9, 9, 9, 9]
    expect(spreadAngles(0, 2, 10, out)).toBe(out)
    expect(out[0]).toBeCloseTo((-5 * Math.PI) / 180)
    expect(out[1]).toBeCloseTo((5 * Math.PI) / 180)
    expect(out).toHaveLength(2)
  })
})
