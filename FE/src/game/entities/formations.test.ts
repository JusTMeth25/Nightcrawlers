import { describe, expect, it } from 'vitest'
import { createRng } from '../systems/rng'
import { formationPositions } from './formations'

const W = 960
const H = 540
const CX = 100
const CY = -50
const outside = (p: { x: number; y: number }) =>
  p.x < CX - W / 2 || p.x > CX + W / 2 || p.y < CY - H / 2 || p.y > CY + H / 2

describe('formationPositions', () => {
  it('ring puts every point at the same distance from the centre', () => {
    const pts = formationPositions('ring', 8, CX, CY, W, H, createRng(1))
    expect(pts).toHaveLength(8)
    const d0 = Math.hypot(pts[0].x - CX, pts[0].y - CY)
    expect(d0).toBeCloseTo(Math.hypot(W, H) / 2, 2)
    for (const p of pts) expect(Math.hypot(p.x - CX, p.y - CY)).toBeCloseTo(d0, 2)
  })

  it('scatter spawns outside the visible rectangle', () => {
    const pts = formationPositions('scatter', 200, CX, CY, W, H, createRng(2))
    for (const p of pts) expect(outside(p)).toBe(true)
  })

  it('respects count for every formation', () => {
    for (const f of ['scatter', 'ring', 'wall', 'swarm'] as const) {
      const pts = formationPositions(f, 13, CX, CY, W, H, createRng(3))
      expect(pts, f).toHaveLength(13)
      // the ring touches the corners by definition (radius = half diagonal)
      if (f !== 'ring') for (const p of pts) expect(outside(p), f).toBe(true)
    }
  })
})

describe('scatterPoint', () => {
  it('writes one off-screen point into the given object', async () => {
    const { scatterPoint } = await import('./formations')
    const out = { x: 0, y: 0 }
    const rng = createRng(9)
    for (let i = 0; i < 50; i++) {
      expect(scatterPoint(CX, CY, W, H, rng, out)).toBe(out)
      expect(outside(out)).toBe(true)
    }
  })
})
