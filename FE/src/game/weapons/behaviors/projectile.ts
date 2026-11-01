// Bullets: `projectiles` shots fanned 8 degrees apart along the firing direction.
import { OWNER_PLAYER } from '../../entities/ProjectilePool'
import { spreadAngles } from '../targeting'
import type { Behavior, FireContext } from '../types'

const FAN_DEG = 8
const BASE_RADIUS = 4
/** scratch array reused by every shot */
const angles: number[] = []

export function createProjectileBehavior(): Behavior {
  return {
    fire({ host, weapon, stats, dir }: FireContext): boolean {
      if (!dir) return false
      const base = Math.atan2(dir.y, dir.x)
      const p = host.player
      for (const a of spreadAngles(base, stats.projectiles, FAN_DEG, angles)) {
        host.projectiles.fire(
          OWNER_PLAYER,
          p.x,
          p.bodyY,
          Math.cos(a) * stats.speed,
          Math.sin(a) * stats.speed,
          stats.durationSec,
          stats.damage,
          stats.pierce,
          BASE_RADIUS * stats.area,
          weapon.color,
        )
      }
      host.sfx('shoot')
      return true
    },
  }
}
