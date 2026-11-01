// Hit geometry shared by weapons, skills and bosses. Pure and allocation-free: the frame loop
// passes its own scratch arrays.
import { balance } from '@data/index'

/** Boss sprite scale on top of the normal sprite scale. */
export const BOSS_SCALE = 1.6
/** The cyberpsycho art is ~1.35x taller than a ganger at the same sprite scale. */
export const BOSS_ART_RATIO = 1.35

/** Hit circle and body offset scale of an enemy, matching how big it is drawn. */
export function enemyBodyScale(elite: boolean, boss: boolean): number {
  return (elite ? balance.elite.scale : 1) * (boss ? BOSS_SCALE * BOSS_ART_RATIO : 1)
}

/** Largest body scale: grid queries grow by this much so big enemies are never missed. */
export const MAX_BODY_SCALE = Math.max(enemyBodyScale(true, false), enemyBodyScale(false, true))

/**
 * Keeps, in place, the first `n` ids of `out` whose hit circle (centre x, y - bodyOff, `radius`)
 * overlaps the circle (qx, qy, qr). Returns the new count.
 */
export function filterCircleHits(
  out: number[],
  n: number,
  qx: number,
  qy: number,
  qr: number,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  bodyOff: ArrayLike<number>,
  radius: ArrayLike<number>,
): number {
  let kept = 0
  for (let k = 0; k < n; k++) {
    const i = out[k]
    const dx = x[i] - qx
    const dy = y[i] - bodyOff[i] - qy
    const r = qr + radius[i]
    if (dx * dx + dy * dy <= r * r) out[kept++] = i
  }
  return kept
}

/**
 * Keeps, in place, the enemies within `reach` (plus their radius) of (qx, qy) whose centre lies
 * inside the arc around the unit direction (dirX, dirY); `cosHalf` = cos(half the arc angle).
 */
export function filterArcHits(
  out: number[],
  n: number,
  qx: number,
  qy: number,
  dirX: number,
  dirY: number,
  cosHalf: number,
  reach: number,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  bodyOff: ArrayLike<number>,
  radius: ArrayLike<number>,
): number {
  let kept = 0
  for (let k = 0; k < n; k++) {
    const i = out[k]
    const dx = x[i] - qx
    const dy = y[i] - bodyOff[i] - qy
    const d = Math.sqrt(dx * dx + dy * dy)
    const r = reach + radius[i]
    if (d > r) continue
    // an enemy standing on the player counts as in front
    if (d > 0.001 && (dx * dirX + dy * dirY) / d < cosHalf) continue
    out[kept++] = i
  }
  return kept
}

/**
 * Enemies touched by a beam from (ax, ay) along the unit direction (dirX, dirY), `length` long and
 * `halfWidth` wide: keeps the nearest `maxHits` in `out`, sorted by distance along the beam.
 * `along` is scratch space indexed by enemy id (pool capacity).
 */
export function beamHits(
  out: number[],
  n: number,
  ax: number,
  ay: number,
  dirX: number,
  dirY: number,
  length: number,
  halfWidth: number,
  maxHits: number,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  bodyOff: ArrayLike<number>,
  radius: ArrayLike<number>,
  along: Float32Array,
): number {
  let kept = 0
  for (let k = 0; k < n; k++) {
    const i = out[k]
    const dx = x[i] - ax
    const dy = y[i] - bodyOff[i] - ay
    const t = dx * dirX + dy * dirY
    const r = radius[i]
    if (t < -r || t > length + r) continue
    const side = dx * -dirY + dy * dirX
    if (Math.abs(side) > halfWidth + r) continue
    along[i] = t
    // insertion sort by distance along the beam
    let j = kept++
    while (j > 0 && along[out[j - 1]] > t) {
      out[j] = out[j - 1]
      j--
    }
    out[j] = i
  }
  return Math.min(kept, Math.max(0, maxHits))
}

export interface MutablePoint {
  x: number
  y: number
}

/** Random point between `minR` and `maxR` from (cx, cy), uniform over the ring area. */
export function pointInRing(
  rng: { next(): number },
  cx: number,
  cy: number,
  minR: number,
  maxR: number,
  out: MutablePoint,
): MutablePoint {
  const a = rng.next() * Math.PI * 2
  const r = Math.sqrt(minR * minR + rng.next() * (maxR * maxR - minR * minR))
  out.x = cx + Math.cos(a) * r
  out.y = cy + Math.sin(a) * r
  return out
}
