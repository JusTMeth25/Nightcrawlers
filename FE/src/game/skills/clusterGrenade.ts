// Cluster grenade (Pilar): one grenade along the aim that bursts into `bomblets` charges, each
// dealing `damage` (the main blast deals it too).
import type { SkillDef } from '@shared/types'
import type { Vec } from '../weapons/targeting'
import type { Skill, SkillHost } from './types'

const DISTANCE = 170
const FLIGHT_SEC = 0.55
const RADIUS = 60
const dir: Vec = { x: 1, y: 0 }

export function createClusterGrenade(def: SkillDef): Skill {
  const bomblets = def.params.bomblets ?? 8
  const damage = def.params.damage ?? 40
  return {
    active: false,

    activate(host: SkillHost): void {
      const p = host.player
      host.aim(dir)
      const tx = p.x + dir.x * DISTANCE
      const ty = p.bodyY + dir.y * DISTANCE
      host.grenades.throw(p.x, p.bodyY, tx, ty, FLIGHT_SEC, damage, RADIUS * host.stats.area, host.characterColor, bomblets)
    },

    update(): void {},

    stop(): void {},
  }
}
