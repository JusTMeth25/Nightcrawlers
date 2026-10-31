import { describe, expect, it } from 'vitest'
import { balance } from '@data/index'
import { BOSS_ART_RATIO, BOSS_SCALE, enemyBodyScale, filterCircleHits, MAX_BODY_SCALE } from './hitShapes'

describe('enemyBodyScale', () => {
  it('is 1 for normal enemies', () => {
    expect(enemyBodyScale(false, false)).toBe(1)
  })

  it('follows the elite sprite scale', () => {
    expect(enemyBodyScale(true, false)).toBeCloseTo(balance.elite.scale)
  })

  it('follows the boss sprite scale and its bigger art', () => {
    expect(enemyBodyScale(false, true)).toBeCloseTo(BOSS_SCALE * BOSS_ART_RATIO)
    expect(MAX_BODY_SCALE).toBeGreaterThanOrEqual(enemyBodyScale(false, true))
  })
})

describe('filterCircleHits', () => {
  // three enemies on the x axis; the second one is big (boss-sized radius)
  const x = new Float32Array([10, 60, 200])
  const y = new Float32Array([0, 0, 0])
  const radius = new Float32Array([5, 30, 5])
  const off = new Float32Array(3)

  it('keeps only the enemies whose circle overlaps the query circle', () => {
    const out = [0, 1, 2]
    const n = filterCircleHits(out, 3, 0, 0, 10, x, y, off, radius)
    // 0: 10 <= 10 + 5; 1: 60 <= 10 + 30 is false; 2 far away
    expect(out.slice(0, n)).toEqual([0])
  })

  it('a bigger hit circle is reached from farther away', () => {
    const out = [0, 1, 2]
    const n = filterCircleHits(out, 3, 25, 0, 6, x, y, off, radius)
    // 0: 15 <= 11; 1: 35 <= 36
    expect(out.slice(0, n)).toEqual([1])
  })
})
