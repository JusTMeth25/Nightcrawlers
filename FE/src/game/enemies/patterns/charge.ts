// Charge: the boss rushes along the line shown by the telegraph (contact damage does the rest).
import { BEAM_LENGTH, TEX_BEAM } from '../../scenes/BootScene'
import { ATTACK_SEC } from '../bossPatterns'
import type { Pattern } from './types'

export const CHARGE_SPEED = 420
const LENGTH = CHARGE_SPEED * ATTACK_SEC.charge
const COLOR = 0xff2a6d

export const charge: Pattern = {
  telegraph(host, boss, sec) {
    const e = host.enemies
    const a = Math.atan2(boss.dirY, boss.dirX)
    host.vfx.show(TEX_BEAM, undefined, e.x[boss.slot], e.bodyY(boss.slot), a, LENGTH / BEAM_LENGTH, 4, COLOR, sec, {
      originX: 0,
      originY: 0.5,
      hold: 0.25,
      alpha: 0.6,
    })
  },

  attack(host) {
    host.sfx('boss')
    host.screen.shake(0.2, 3)
  },

  update(host, boss, dt) {
    const e = host.enemies
    e.x[boss.slot] += boss.dirX * CHARGE_SPEED * dt
    e.y[boss.slot] += boss.dirY * CHARGE_SPEED * dt
  },
}
