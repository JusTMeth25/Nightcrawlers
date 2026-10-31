import { describe, expect, it } from 'vitest'
import { SpatialGrid } from './spatialGrid'

const filled = () => {
  const g = new SpatialGrid(64)
  g.insert(1, 0, 0)
  g.insert(2, 30, 40)
  g.insert(3, 500, -500)
  return g
}

describe('SpatialGrid', () => {
  it('counts points inside the radius and fills out', () => {
    const out: number[] = []
    expect(filled().queryRadius(10, 10, 60, out)).toBe(2)
    expect(out.slice(0, 2).sort()).toEqual([1, 2])
  })

  it('handles negative coordinates and cell borders', () => {
    const out: number[] = []
    expect(filled().queryRadius(500, -500, 1, out)).toBe(1)
    expect(out[0]).toBe(3)
  })

  it('finds the nearest id within maxR', () => {
    const g = filled()
    expect(g.nearest(25, 35, 1000)).toBe(2)
    expect(g.nearest(1000, 1000, 50)).toBe(-1)
  })

  it('is empty after clear', () => {
    const g = filled()
    g.clear()
    expect(g.queryRadius(0, 0, 10000, [])).toBe(0)
    expect(g.nearest(0, 0, 10000)).toBe(-1)
  })
})
