// Spawn positions around the visible area (world units). Pure: uses only the run RNG.
import type { Formation } from '../systems/director'
import type { Rng } from '../systems/rng'

/** distance outside the visible edge where enemies appear */
export const SPAWN_MARGIN = 48

export interface Point {
  x: number
  y: number
}

type Side = 0 | 1 | 2 | 3 // top, right, bottom, left

/** Writes a point just outside `side` into `p`; `t` in [0,1] runs along it. */
function edgeInto(p: Point, side: Side, t: number, cx: number, cy: number, hw: number, hh: number, out: number): Point {
  switch (side) {
    case 0:
      p.x = cx - hw + t * hw * 2
      p.y = cy - hh - out
      break
    case 1:
      p.x = cx + hw + out
      p.y = cy - hh + t * hh * 2
      break
    case 2:
      p.x = cx - hw + t * hw * 2
      p.y = cy + hh + out
      break
    default:
      p.x = cx - hw - out
      p.y = cy - hh + t * hh * 2
  }
  return p
}

function edgePoint(side: Side, t: number, cx: number, cy: number, hw: number, hh: number, out: number): Point {
  return edgeInto({ x: 0, y: 0 }, side, t, cx, cy, hw, hh, out)
}

/** One scatter position written into `out` (no allocation: used by the frame loop). */
export function scatterPoint(cx: number, cy: number, viewW: number, viewH: number, rng: Rng, out: Point): Point {
  const side = rng.int(0, 3) as Side
  return edgeInto(out, side, rng.next(), cx, cy, viewW / 2, viewH / 2, SPAWN_MARGIN + rng.next() * SPAWN_MARGIN)
}

export function formationPositions(
  formation: Formation,
  count: number,
  cx: number,
  cy: number,
  viewW: number,
  viewH: number,
  rng: Rng,
): Point[] {
  const hw = viewW / 2
  const hh = viewH / 2
  const pts: Point[] = []
  switch (formation) {
    case 'ring': {
      const r = Math.hypot(viewW, viewH) / 2
      const start = rng.next() * Math.PI * 2
      for (let i = 0; i < count; i++) {
        const a = start + (i / count) * Math.PI * 2
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
      }
      break
    }
    case 'wall': {
      // a line along one side; the enemies then advance by chasing
      const side = rng.int(0, 3) as Side
      for (let i = 0; i < count; i++) {
        pts.push(edgePoint(side, count === 1 ? 0.5 : i / (count - 1), cx, cy, hw, hh, SPAWN_MARGIN))
      }
      break
    }
    case 'swarm': {
      const side = rng.int(0, 3) as Side
      const centre = edgePoint(side, 0.2 + rng.next() * 0.6, cx, cy, hw, hh, SPAWN_MARGIN)
      const spread = 16 + Math.sqrt(count) * 8
      // push the group further out so its spread never reaches the screen
      const ox = side === 1 ? spread : side === 3 ? -spread : 0
      const oy = side === 2 ? spread : side === 0 ? -spread : 0
      for (let i = 0; i < count; i++) {
        const a = rng.next() * Math.PI * 2
        const d = Math.sqrt(rng.next()) * spread
        pts.push({ x: centre.x + ox + Math.cos(a) * d, y: centre.y + oy + Math.sin(a) * d })
      }
      break
    }
    default: {
      for (let i = 0; i < count; i++) pts.push(scatterPoint(cx, cy, viewW, viewH, rng, { x: 0, y: 0 }))
    }
  }
  return pts
}
