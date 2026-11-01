// Cone blast: a 60 degree fan of enemy shots towards where the player stood at the telegraph.
import { OWNER_ENEMY } from '../../entities/ProjectilePool'
import { TEX_WEDGE, WEDGE_RADIUS } from '../../scenes/BootScene'
import type { Pattern } from './types'

const SHOTS = 13
const HALF_RAD = Math.PI / 6
const SPEED = 230
const LIFE_SEC = 2.2
const RADIUS = 6
const DAMAGE_SHARE = 0.5
const REACH = SPEED * LIFE_SEC * 0.5
const COLOR = 0xff0054

export const coneBlast: Pattern = {
  telegraph(host, boss, sec) {
    const e = host.enemies
    const a = Math.atan2(boss.dirY, boss.dirX)
    const s = REACH / WEDGE_RADIUS
    host.vfx.show(TEX_WEDGE, undefined, e.x[boss.slot], e.bodyY(boss.slot), a, s, s, COLOR, sec, {
      originX: 0,
      originY: 0.5,
      hold: 0.25,
      alpha: 0.7,
      telegraphOwner: boss.slot,
    })
  },

  attack(host, boss) {
    const e = host.enemies
    const i = boss.slot
    const base = Math.atan2(boss.dirY, boss.dirX)
    for (let k = 0; k < SHOTS; k++) {
      const a = base + (k / (SHOTS - 1) - 0.5) * 2 * HALF_RAD
      host.projectiles.fire(OWNER_ENEMY, e.x[i], e.bodyY(i), Math.cos(a) * SPEED, Math.sin(a) * SPEED, LIFE_SEC, e.damage[i] * DAMAGE_SHARE, 1, RADIUS, COLOR)
    }
    host.sfx('boss')
  },
}
