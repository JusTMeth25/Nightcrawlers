// Explosive barrage (Rebecca): `grenades` grenades in a 70 degree fan along the aim, each exploding
// over `radius` x area for `damage`.
import type { SkillDef } from '@shared/types'
import type { Vec } from '../weapons/targeting'
import type { Skill, SkillHost } from './types'

const FAN_RAD = (70 * Math.PI) / 180
const MIN_DIST = 120
const MAX_DIST = 200
const FLIGHT_SEC = 0.45
const dir: Vec = { x: 1, y: 0 }

export function createExplosiveBarrage(def: SkillDef): Skill {
  const grenades = def.params.grenades ?? 6
  const damage = def.params.damage ?? 60
  const radius = def.params.radius ?? 70
  return {
    active: false,

    activate(host: SkillHost): void {
      const p = host.player
      host.aim(dir)
      const base = Math.atan2(dir.y, dir.x)
      for (let k = 0; k < grenades; k++) {
        const a = base + (grenades > 1 ? (k / (grenades - 1) - 0.5) * FAN_RAD : 0)
        const d = MIN_DIST + host.rng.next() * (MAX_DIST - MIN_DIST)
        const flight = FLIGHT_SEC * (0.8 + 0.4 * host.rng.next())
        const tx = p.x + Math.cos(a) * d
        const ty = p.bodyY + Math.sin(a) * d
        host.grenades.throw(p.x, p.bodyY, tx, ty, flight, damage, radius * host.stats.area, host.characterColor)
      }
    },

    update(): void {},

    stop(): void {},
  }
}
