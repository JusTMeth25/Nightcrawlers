// One game frame, without Phaser: clamp the delta, freeze while paused, and stop before
// player damage when the simulation itself opened a modal (level-up from a pickup, chest).

/** Longest frame step: a tab back from background must not teleport anything. */
export const MAX_FRAME_MS = 100

export interface FrameHost {
  isPaused(): boolean
  advanceClock(dtSec: number): void
  /** movement, spawns, enemies, weapons, pickups, chests: may pause the game */
  simulate(dtSec: number): void
  /** contact damage and enemy shots on the player */
  resolveDamage(dtSec: number): void
}

export function clampDeltaSec(deltaMs: number): number {
  return Math.min(Math.max(deltaMs, 0), MAX_FRAME_MS) / 1000
}

/** Returns false when the frame was skipped because the game is paused. */
export function stepFrame(deltaMs: number, host: FrameHost): boolean {
  if (host.isPaused()) return false
  const dt = clampDeltaSec(deltaMs)
  host.advanceClock(dt)
  host.simulate(dt)
  if (host.isPaused()) return true
  host.resolveDamage(dt)
  return true
}
