// Summon: Maelstrom gangers appear on a circle around the boss, where the telegraph marks them.
import type { Pattern } from './types'

const COUNT = 6
const RADIUS = 90
const COLOR = 0xff2a6d

export const summon: Pattern = {
  telegraph(host, boss, sec) {
    const e = host.enemies
    const x = e.x[boss.slot]
    const y = e.y[boss.slot]
    for (let k = 0; k < COUNT; k++) {
      const a = (k / COUNT) * Math.PI * 2
      host.vfx.ring(x + Math.cos(a) * RADIUS, y + Math.sin(a) * RADIUS, 14, COLOR, sec, 0)
    }
  },

  attack(host, boss) {
    const e = host.enemies
    host.spawnAround('maelstrom', e.x[boss.slot], e.y[boss.slot], COUNT, RADIUS)
    host.sfx('boss')
  },
}
