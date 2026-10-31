// Grenade launcher: `projectiles` grenades lobbed to random points around the player; each
// explodes on landing over EXPLOSION_RADIUS x `area`. Flight time is distance / `speed`, capped by
// `durationSec`.
import { pointInRing, type MutablePoint } from '../../systems/hitShapes'
import type { Behavior, FireContext } from '../types'

const MIN_RANGE = 60
const MAX_RANGE = 220
const EXPLOSION_RADIUS = 40
const point: MutablePoint = { x: 0, y: 0 }

export function createLobBehavior(): Behavior {
  return {
    fire({ host, weapon, stats }: FireContext): boolean {
      const p = host.player
      for (let k = 0; k < stats.projectiles; k++) {
        pointInRing(host.rng, p.x, p.bodyY, MIN_RANGE, MAX_RANGE, point)
        const dist = Math.hypot(point.x - p.x, point.y - p.bodyY)
        const flight = Math.min(stats.durationSec, dist / Math.max(1, stats.speed))
        host.grenades.throw(p.x, p.bodyY, point.x, point.y, flight, stats.damage, EXPLOSION_RADIUS * stats.area, weapon.color)
      }
      host.sfx('shoot')
      return true
    },
  }
}
