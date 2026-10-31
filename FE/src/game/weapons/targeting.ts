// Where a weapon fires (spec 2.3): `aim` uses the player's aim, else the nearest enemy, else
// the last movement; `nearest` needs a target; `area` lets the behaviour decide.
import type { AimType } from '@shared/types'
import type { InputState } from '../input/InputState'

export interface Vec {
  x: number
  y: number
}

function unit(x: number, y: number): Vec | null {
  const len = Math.hypot(x, y)
  return len === 0 ? null : { x: x / len, y: y / len }
}

export function aimDirection(
  aimType: AimType,
  input: InputState,
  playerPos: Vec,
  nearest: Vec | null,
  lastMoveDir: Vec,
): Vec | null {
  if (aimType === 'area') return null
  const toNearest = nearest ? unit(nearest.x - playerPos.x, nearest.y - playerPos.y) : null
  if (aimType === 'nearest') return toNearest
  if (input.aimActive) {
    const aim = unit(input.aimX, input.aimY)
    if (aim) return aim
  }
  return toNearest ?? unit(lastMoveDir.x, lastMoveDir.y) ?? { x: 1, y: 0 }
}

/** `count` angles `stepDeg` apart, centred on `base` (radians). */
export function spreadAngles(base: number, count: number, stepDeg: number): number[] {
  const step = (stepDeg * Math.PI) / 180
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(base + (i - (count - 1) / 2) * step)
  return out
}
