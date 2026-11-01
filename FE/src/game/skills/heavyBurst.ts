// Heavy burst (Dorio): for the duration, piercing rounds along the aim at a very high rate:
// `dps` damage per second split over the rounds, each piercing `pierce` enemies.
import type { SkillDef } from '@shared/types'
import { OWNER_PLAYER } from '../entities/ProjectilePool'
import type { Vec } from '../weapons/targeting'
import type { Skill, SkillHost } from './types'

const ROUND_EVERY_SEC = 0.05
const SPEED = 720
const LIFE_SEC = 0.7
const RADIUS = 4.5
const JITTER_RAD = (4 * Math.PI) / 180
const dir: Vec = { x: 1, y: 0 }

export function createHeavyBurst(def: SkillDef): Skill {
  const dps = def.params.dps ?? 160
  const pierce = def.params.pierce ?? 5
  let left = 0
  let nextIn = 0
  let rounds = 0

  return {
    get active() {
      return left > 0
    },

    activate(_host: SkillHost, durationSec: number): void {
      left = durationSec
      nextIn = 0
    },

    update(host: SkillHost, dt: number): void {
      if (left <= 0) return
      left -= dt
      nextIn -= dt
      const p = host.player
      while (nextIn <= 0) {
        nextIn += ROUND_EVERY_SEC
        host.aim(dir)
        const a = Math.atan2(dir.y, dir.x) + (host.rng.next() * 2 - 1) * JITTER_RAD
        const speed = SPEED * host.stats.projectileSpeed
        host.projectiles.fire(
          OWNER_PLAYER,
          p.x,
          p.bodyY,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          LIFE_SEC,
          dps * ROUND_EVERY_SEC,
          pierce,
          RADIUS * host.stats.area,
          host.characterColor,
        )
        if (rounds++ % 3 === 0) host.sfx('shoot')
      }
    },

    stop(): void {
      left = 0
    },
  }
}
