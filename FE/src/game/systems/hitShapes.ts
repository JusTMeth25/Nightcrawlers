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
