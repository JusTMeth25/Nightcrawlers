// Heavy rifle: `projectiles` instant beams fanned 6 degrees apart along the aim. Each beam is
// BEAM_LENGTH x `area` long and hits up to `pierce` enemies, nearest first. `durationSec` is how
// long the beam stays visible; `speed` is unused (the beam is instant).
import { BEAM_LENGTH as TEX_BEAM_LENGTH, TEX_BEAM } from '../../scenes/BootScene'
import { spreadAngles } from '../targeting'
import { damageBeam } from '../area'
import type { Behavior, CombatHost, FireContext } from '../types'

export const BEAM_LENGTH = 380
const FAN_DEG = 6
const HALF_WIDTH = 6
const KNOCK = 80
const angles: number[] = []

/** Fires one beam and draws it; shared with the snipe skill. */
export function fireBeam(
  host: CombatHost,
  x: number,
  y: number,
  angle: number,
  length: number,
  halfWidth: number,
  maxHits: number,
  damage: number,
  color: number,
  visibleSec: number,
): void {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  damageBeam(host, x, y, dx, dy, length, halfWidth, maxHits, damage, KNOCK)
  host.vfx.show(TEX_BEAM, undefined, x, y, angle, length / TEX_BEAM_LENGTH, (halfWidth * 2) / 8, color, visibleSec, {
    originX: 0,
    originY: 0.5,
  })
}

export function createPierceBeamBehavior(): Behavior {
  return {
    fire({ host, weapon, stats, dir }: FireContext): boolean {
      if (!dir) return false
      const p = host.player
      const base = Math.atan2(dir.y, dir.x)
      for (const a of spreadAngles(base, stats.projectiles, FAN_DEG, angles)) {
        fireBeam(host, p.x, p.bodyY, a, BEAM_LENGTH * stats.area, HALF_WIDTH * stats.area, stats.pierce, stats.damage, weapon.color, stats.durationSec)
      }
      host.sfx('shoot')
      return true
    },
  }
}
