// Damage shapes used by weapons, skills and grenades: circle, arc and beam.
// One scratch buffer: the callers never nest these calls.
import { beamHits, filterArcHits } from '../systems/hitShapes'
import type { CombatHost } from './types'

const found: number[] = []
let along = new Float32Array(0)

/** Damages every enemy overlapping the circle, pushing them outwards. Returns the hit count. */
export function damageCircle(host: CombatHost, x: number, y: number, r: number, damage: number, knock: number): number {
  const e = host.enemies
  const n = e.queryHits(host.grid, x, y, r, found)
  for (let k = 0; k < n; k++) {
    const i = found[k]
    if (!e.active[i]) continue
    const dx = e.x[i] - x
    const dy = e.bodyY(i) - y
    const d = Math.hypot(dx, dy) || 1
    host.damageEnemy(i, damage, (dx / d) * knock, (dy / d) * knock)
  }
  return n
}

/** Damages enemies in an arc in front of the unit direction (dirX, dirY). */
export function damageArc(
  host: CombatHost,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  cosHalf: number,
  reach: number,
  damage: number,
  knock: number,
): number {
  const e = host.enemies
  let n = e.queryHits(host.grid, x, y, reach, found)
  n = filterArcHits(found, n, x, y, dirX, dirY, cosHalf, reach, e.x, e.y, e.bodyOff, e.radius)
  for (let k = 0; k < n; k++) {
    const i = found[k]
    if (e.active[i]) host.damageEnemy(i, damage, dirX * knock, dirY * knock)
  }
  return n
}

/** Damages up to `maxHits` enemies along a beam, nearest first. */
export function damageBeam(
  host: CombatHost,
  ax: number,
  ay: number,
  dirX: number,
  dirY: number,
  length: number,
  halfWidth: number,
  maxHits: number,
  damage: number,
  knock: number,
): number {
  const e = host.enemies
  if (along.length < e.cap) along = new Float32Array(e.cap)
  const half = length / 2
  let n = host.grid.queryRadius(ax + dirX * half, ay + dirY * half, half + halfWidth + 64, found)
  n = beamHits(found, n, ax, ay, dirX, dirY, length, halfWidth, maxHits, e.x, e.y, e.bodyOff, e.radius, along)
  for (let k = 0; k < n; k++) {
    const i = found[k]
    if (e.active[i]) host.damageEnemy(i, damage, dirX * knock, dirY * knock)
  }
  return n
}
