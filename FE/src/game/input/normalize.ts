// Pure helpers shared by the input adapters.
import { emptyInput, resetInput, type InputSource, type InputState } from './InputState'

/** Radial deadzone: below `dz` returns zero, above it the length is rescaled to 0-1. */
export function applyDeadzone(x: number, y: number, dz = 0.25): [number, number] {
  const len = Math.hypot(x, y)
  if (len < dz || len === 0) return [0, 0]
  const scaled = Math.min(1, (len - dz) / (1 - dz))
  return [(x / len) * scaled, (y / len) * scaled]
}

export function normalize(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y)
  return len === 0 ? [0, 0] : [x / len, y / len]
}

/** Clamps a vector to length 1 without changing shorter ones (analog input keeps its strength). */
export function clampLength(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y)
  return len > 1 ? [x / len, y / len] : [x, y]
}

const ORDER: readonly InputSource[] = ['kbm', 'touch', 'pad']

/**
 * `sources` is indexed as [kbm, touch, pad]; null = device absent (e.g. pad unplugged).
 * Movement and aim come from the most recently used live source; skill and pause are ORed.
 */
export function mergeInput(sources: (InputState | null)[], last: InputSource, out: InputState = emptyInput()): InputState {
  resetInput(out)
  let primary = sources[ORDER.indexOf(last)] ?? null
  if (!primary) primary = sources.find((s) => s !== null) ?? null
  if (primary) {
    out.moveX = primary.moveX
    out.moveY = primary.moveY
    out.aimX = primary.aimX
    out.aimY = primary.aimY
    out.aimActive = primary.aimActive
  }
  for (const s of sources) {
    if (!s) continue
    out.skill ||= s.skill
    out.pause ||= s.pause
  }
  return out
}
