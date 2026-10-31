import { describe, expect, it } from 'vitest'
import { cellHash } from './cityHash'
import { computeZoom } from './view'

describe('computeZoom', () => {
  it('shows the same world area on every screen', () => {
    expect(computeZoom(960, 540)).toBe(1)
    expect(computeZoom(1920, 1080)).toBe(2)
    expect(computeZoom(0, 0)).toBe(1)
  })
})

describe('cellHash', () => {
  it('is stable per seed and cell and differs between cells', () => {
    expect(cellHash(1, 3, -4)).toBe(cellHash(1, 3, -4))
    expect(cellHash(1, 3, -4)).not.toBe(cellHash(1, -4, 3))
    expect(cellHash(1, 3, -4)).not.toBe(cellHash(2, 3, -4))
  })
})
