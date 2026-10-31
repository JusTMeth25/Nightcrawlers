import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

const take = (seed: number, n: number) => {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => rng.next())
}

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(take(42, 5)).toEqual(take(42, 5))
  })

  it('gives different sequences for different seeds', () => {
    expect(take(42, 5)).not.toEqual(take(43, 5))
  })

  it('returns values in [0, 1)', () => {
    for (const v of take(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int covers the inclusive range and nothing else', () => {
    const rng = createRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) seen.add(rng.int(1, 3))
    expect([...seen].sort()).toEqual([1, 2, 3])
  })

  it('weighted never picks a zero weight', () => {
    const rng = createRng(5)
    for (let i = 0; i < 200; i++) {
      expect(rng.weighted([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }])).toBe('b')
    }
  })

  it('pick returns an element of the array', () => {
    const rng = createRng(9)
    const arr = ['x', 'y', 'z'] as const
    for (let i = 0; i < 50; i++) expect(arr).toContain(rng.pick(arr))
  })
})
