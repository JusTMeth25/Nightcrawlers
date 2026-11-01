// Snipe (Kiwi): one piercing shot along the aim, `damage` to up to `pierce` enemies.
import type { SkillDef } from '@shared/types'
import { fireBeam } from '../weapons/behaviors/pierceBeam'
import type { Vec } from '../weapons/targeting'
import type { Skill, SkillHost } from './types'

const LENGTH = 900
const HALF_WIDTH = 8
const VISIBLE_SEC = 0.45
const dir: Vec = { x: 1, y: 0 }

export function createSnipe(def: SkillDef): Skill {
  const damage = def.params.damage ?? 300
  const pierce = def.params.pierce ?? 99
  return {
    active: false,

    activate(host: SkillHost): void {
      const p = host.player
      host.aim(dir)
      const angle = Math.atan2(dir.y, dir.x)
      fireBeam(host, p.x, p.bodyY, angle, LENGTH, HALF_WIDTH * host.stats.area, pierce, damage, host.characterColor, VISIBLE_SEC)
      // white core over the coloured beam
      fireBeam(host, p.x, p.bodyY, angle, LENGTH, 2, 0, 0, 0xffffff, VISIBLE_SEC * 0.6)
      host.screen.shake(0.12, 4)
    },

    update(): void {},

    stop(): void {},
  }
}
