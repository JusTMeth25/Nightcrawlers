// Shotgun: `projectiles` pellets spread over a 30 degree cone, with small seeded jitter.
import { OWNER_PLAYER } from '../../entities/ProjectilePool'
import { spreadAngles } from '../targeting'
import type { Behavior, FireContext } from '../types'

const CONE_DEG = 30
const JITTER_DEG = 2
const SPEED_JITTER = 0.1
const BASE_RADIUS = 3.5

export function createConeBehavior(): Behavior {
  return {
    fire({ host, weapon, stats, dir }: FireContext): boolean {
      if (!dir) return false
      const base = Math.atan2(dir.y, dir.x)
      const n = stats.projectiles
      const step = n > 1 ? CONE_DEG / (n - 1) : 0
      const p = host.player
      for (const a of spreadAngles(base, n, step)) {
        const angle = a + ((host.rng.next() * 2 - 1) * JITTER_DEG * Math.PI) / 180
        const speed = stats.speed * (1 + (host.rng.next() * 2 - 1) * SPEED_JITTER)
        host.projectiles.fire(
          OWNER_PLAYER,
          p.x,
          p.bodyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          stats.durationSec,
          stats.damage,
          stats.pierce,
          BASE_RADIUS * stats.area,
          weapon.color,
        )
      }
      return true
    },
  }
}
