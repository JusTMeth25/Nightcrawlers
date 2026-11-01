// Shockwave: the boss slams the ground; the player inside the marked circle takes the boss damage.
import { PLAYER_RADIUS } from '../../world/view'
import type { Pattern } from './types'

export const SHOCKWAVE_RADIUS = 150
const COLOR = 0xff0054

export const shockwave: Pattern = {
  telegraph(host, boss, sec) {
    const e = host.enemies
    host.vfx.ring(e.x[boss.slot], e.y[boss.slot], SHOCKWAVE_RADIUS, COLOR, sec, 0, boss.slot)
  },

  attack(host, boss) {
    const e = host.enemies
    const i = boss.slot
    const x = e.x[i]
    const y = e.y[i]
    host.vfx.ring(x, y, SHOCKWAVE_RADIUS, 0xffffff, 0.35, 0.4)
    host.screen.shake(0.3, 6)
    host.sfx('explode')
    const p = host.player
    const r = SHOCKWAVE_RADIUS + PLAYER_RADIUS
    if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) host.hurtPlayer(e.damage[i])
  },
}
