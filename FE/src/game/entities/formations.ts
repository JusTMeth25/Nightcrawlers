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

/** A point just outside `side`; `t` in [0,1] runs along it. */
function edgePoint(side: Side, t: number, cx: number, cy: number, hw: number, hh: number, out: number): Point {
  switch (side) {
    case 0:
      return { x: cx - hw + t * hw * 2, y: cy - hh - out }
    case 1:
      return { x: cx + hw + out, y: cy - hh + t * hh * 2 }
    case 2:
      return { x: cx - hw + t * hw * 2, y: cy + hh + out }
    default:
      return { x: cx - hw - out, y: cy - hh + t * hh * 2 }
  }
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
      for (let i = 0; i < count; i++) {
        pts.push(edgePoint(rng.int(0, 3) as Side, rng.next(), cx, cy, hw, hh, SPAWN_MARGIN + rng.next() * SPAWN_MARGIN))
      }
    }
  }
  return pts
}
