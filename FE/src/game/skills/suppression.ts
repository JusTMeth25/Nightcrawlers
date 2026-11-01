// Suppression (Maine): a continuous cone of fire along the aim for the duration, `dps` damage and
// `knockback` push to everything inside it.
import type { SkillDef } from '@shared/types'
import { BEAM_LENGTH, TEX_BEAM } from '../scenes/BootScene'
import { damageArc } from '../weapons/area'
import type { Vec } from '../weapons/targeting'
import type { Skill, SkillHost } from './types'

const TICK_SEC = 0.1
const REACH = 230
const TRACERS_PER_TICK = 3
const dir: Vec = { x: 1, y: 0 }

export function createSuppression(def: SkillDef): Skill {
  const halfRad = (((def.params.coneDeg ?? 50) / 2) * Math.PI) / 180
  const cosHalf = Math.cos(halfRad)
  const dps = def.params.dps ?? 120
  const knockback = def.params.knockback ?? 200
  let left = 0
  let tickIn = 0
  let ticks = 0

  const skill: Skill = {
    get active() {
      return left > 0
    },

    activate(_host: SkillHost, durationSec: number): void {
      left = durationSec
      tickIn = 0
    },

    update(host: SkillHost, dt: number): void {
      if (left <= 0) return
      left -= dt
      tickIn -= dt
      if (tickIn > 0) return
      tickIn += TICK_SEC
      const p = host.player
      host.aim(dir)
      const reach = REACH * host.stats.area
      damageArc(host, p.x, p.bodyY, dir.x, dir.y, cosHalf, reach, dps * TICK_SEC, knockback)
      const base = Math.atan2(dir.y, dir.x)
      for (let k = 0; k < TRACERS_PER_TICK; k++) {
        const a = base + (host.rng.next() * 2 - 1) * halfRad
        const len = reach * (0.6 + 0.4 * host.rng.next())
        host.vfx.show(TEX_BEAM, undefined, p.x, p.bodyY, a, len / BEAM_LENGTH, 0.4, host.characterColor, 0.12, {
          originX: 0,
          originY: 0.5,
        })
      }
      // one shot sound every other tick is plenty
      if (ticks++ % 2 === 0) host.sfx('shoot')
    },

    stop(): void {
      left = 0
    },
  }
  return skill
}
