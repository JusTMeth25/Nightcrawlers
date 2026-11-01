// Quickhack (Lucy): short circuit around the player, damage and stun within `radius` x area.
// Bosses are stunned for a quarter of the time.
import type { SkillDef } from '@shared/types'
import { TEX_PIXEL } from '../scenes/BootScene'
import type { Skill, SkillHost } from './types'

const BOSS_STUN_SHARE = 0.25
const found: number[] = []

export function createQuickhack(def: SkillDef): Skill {
  const radius = def.params.radius ?? 180
  const stunSec = def.params.stunSec ?? 2
  const damage = def.params.damage ?? 40
  return {
    active: false,

    activate(host: SkillHost): void {
      const p = host.player
      const e = host.enemies
      const r = radius * host.stats.area
      const stun = stunSec * host.stats.duration
      host.vfx.ring(p.x, p.bodyY, r, host.characterColor, 0.45, 0.6)
      host.vfx.ring(p.x, p.bodyY, r * 0.6, 0xffffff, 0.3, 0.8)
      const n = e.queryHits(host.grid, p.x, p.bodyY, r, found)
      for (let k = 0; k < n; k++) {
        const i = found[k]
        if (!e.active[i]) continue
        e.stun(i, e.boss[i] ? stun * BOSS_STUN_SHARE : stun)
        // a short vertical spark on every hacked enemy
        host.vfx.show(TEX_PIXEL, undefined, e.x[i], e.bodyY(i), 0, 0.5, 5, host.characterColor, 0.25, { grow: 1 })
        host.damageEnemy(i, damage, 0, 0)
      }
      host.screen.shake(0.15, 3)
    },

    update(): void {},

    stop(): void {},
  }
}
