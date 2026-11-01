import { describe, expect, it } from 'vitest'
import { balance } from '@data/index'
import {
  beamHits,
  BOSS_ART_RATIO,
  BOSS_SCALE,
  enemyBodyScale,
  filterArcHits,
  filterCircleHits,
  MAX_BODY_SCALE,
  pointInRing,
} from './hitShapes'
import { createRng } from './rng'

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

describe('filterArcHits', () => {
  // enemies around the origin: east, north, west, far east
  const x = new Float32Array([30, 0, -30, 300])
  const y = new Float32Array([0, -30, 0, 0])
  const off = new Float32Array(4)
  const radius = new Float32Array([5, 5, 5, 5])

  it('keeps enemies inside the arc in front of the direction', () => {
    const out = [0, 1, 2, 3]
    // facing east, 120 degree arc (half 60), reach 50
    const n = filterArcHits(out, 4, 0, 0, 1, 0, Math.cos(Math.PI / 3), 50, x, y, off, radius)
    expect(out.slice(0, n)).toEqual([0])
  })

  it('a wide arc reaches the sides but not behind', () => {
    const out = [0, 1, 2, 3]
    // half angle 100 degrees
    const n = filterArcHits(out, 4, 0, 0, 1, 0, Math.cos((100 * Math.PI) / 180), 50, x, y, off, radius)
    expect(out.slice(0, n)).toEqual([0, 1])
  })
})

describe('beamHits', () => {
  // enemies along the x axis at 300, 100, 200, and one off the line
  const x = new Float32Array([300, 100, 200, 150])
  const y = new Float32Array([0, 2, -3, 60])
  const off = new Float32Array(4)
  const radius = new Float32Array([5, 5, 5, 5])
  const along = new Float32Array(4)

  it('keeps enemies touching the beam, nearest first, at most maxHits', () => {
    const out = [0, 1, 2, 3]
    const n = beamHits(out, 4, 0, 0, 1, 0, 400, 4, 2, x, y, off, radius, along)
    expect(out.slice(0, n)).toEqual([1, 2])
  })

  it('stops at the beam length', () => {
    const out = [0, 1, 2, 3]
    const n = beamHits(out, 4, 0, 0, 1, 0, 250, 4, 10, x, y, off, radius, along)
    expect(out.slice(0, n)).toEqual([1, 2])
  })
})

describe('pointInRing', () => {
  it('stays between the two radii', () => {
    const rng = createRng(7)
    const p = { x: 0, y: 0 }
    for (let i = 0; i < 200; i++) {
      pointInRing(rng, 10, 20, 40, 100, p)
      const d = Math.hypot(p.x - 10, p.y - 20)
      expect(d).toBeGreaterThanOrEqual(40 - 1e-6)
      expect(d).toBeLessThanOrEqual(100 + 1e-6)
    }
  })
})
