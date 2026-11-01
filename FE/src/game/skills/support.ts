// Support (Falco): heals `healPct` of max HP and deploys one extra drone for the duration. The extra
// drone fires like the owned drone weapon (its level, or level 1 when the drone is not owned).
import { getWeapon } from '@data/index'
import type { SkillDef, WeaponLevelStats } from '@shared/types'
import { weaponStats } from '../systems/weapons'
import { createDroneBehavior, type DroneBehavior } from '../weapons/behaviors/drone'
import type { WeaponRuntime } from '../weapons/types'
import type { Skill, SkillHost } from './types'

export function createSupport(def: SkillDef, host: SkillHost): Skill {
  const healPct = def.params.healPct ?? 0.3
  // offset by half a turn so it does not overlap the weapon's first drone
  const drone: DroneBehavior = createDroneBehavior(host.gameScene, Math.PI)
  const runtime: WeaponRuntime = {
    owned: { id: 'drone', level: 1, evolved: false },
    def: getWeapon('drone'),
    cooldownLeft: 0,
    color: host.characterColor,
  }
  let stats: WeaponLevelStats | null = null
  let left = 0

  const skill: Skill = {
    get active() {
      return left > 0
    },

    activate(h: SkillHost, durationSec: number): void {
      h.heal(h.player.maxHp * healPct)
      h.vfx.ring(h.player.x, h.player.bodyY, 60, 0x7cffb2, 0.5, 0.8)
      left = durationSec
      const owned = h.inventoryWeapon('drone')
      runtime.owned = owned ?? { id: 'drone', level: 1, evolved: false }
      // one drone: computed once per activation, not per frame
      stats = { ...weaponStats(runtime.owned, h.stats), projectiles: 1 }
      runtime.cooldownLeft = 0
    },

    update(h: SkillHost, dt: number): void {
      if (left <= 0 || !stats) return
      left -= dt
      if (left <= 0) {
        skill.stop(h)
        return
      }
      drone.update?.(h, runtime, stats, dt)
      runtime.cooldownLeft -= dt
      if (runtime.cooldownLeft > 0) return
      const fired = drone.fire({ host: h, weapon: runtime, stats, dir: null, input: h.inputState })
      runtime.cooldownLeft = fired ? stats.cooldownSec : 0
    },

    stop(): void {
      left = 0
      drone.hide()
    },

    destroy(): void {
      drone.destroy?.()
    },
  }
  return skill
}
