// Where a weapon fires (spec 2.3): `aim` uses the player's aim, else the nearest enemy, else
// the last movement; `nearest` needs a target; `area` lets the behaviour decide.
// The `out` parameters let the frame loop reuse scratch objects instead of allocating.
import type { AimType } from '@shared/types'
import type { InputState } from '../input/InputState'

export interface Vec {
  x: number
  y: number
}

/** Writes the unit vector of (x, y) into `out`; false for a zero vector. */
function unitInto(x: number, y: number, out: Vec): boolean {
  const len = Math.hypot(x, y)
  if (len === 0) return false
  out.x = x / len
  out.y = y / len
  return true
}

export function aimDirection(
  aimType: AimType,
  input: InputState,
  playerPos: Vec,
  nearest: Vec | null,
  lastMoveDir: Vec,
  out: Vec = { x: 0, y: 0 },
): Vec | null {
  if (aimType === 'area') return null
  const hasNearest = nearest !== null && unitInto(nearest.x - playerPos.x, nearest.y - playerPos.y, out)
  if (aimType === 'nearest') return hasNearest ? out : null
  if (input.aimActive && unitInto(input.aimX, input.aimY, out)) return out
  if (hasNearest && nearest) {
    unitInto(nearest.x - playerPos.x, nearest.y - playerPos.y, out)
    return out
  }
  if (unitInto(lastMoveDir.x, lastMoveDir.y, out)) return out
  out.x = 1
  out.y = 0
  return out
}

/** `count` angles `stepDeg` apart, centred on `base` (radians), written into `out`. */
export function spreadAngles(base: number, count: number, stepDeg: number, out: number[] = []): number[] {
  const step = (stepDeg * Math.PI) / 180
  out.length = count
  for (let i = 0; i < count; i++) out[i] = base + (i - (count - 1) / 2) * step
  return out
}
