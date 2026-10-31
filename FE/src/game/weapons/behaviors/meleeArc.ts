// Mantis blades: `projectiles` slashes per strike, evenly spread around the facing direction
// (1 = front, 2 = front and back, ...). Strikes alternate their swing side. A slash hits every
// enemy in a 120 degree arc within REACH x `area` at once; `durationSec` is the slash animation.
import { ARC_RADIUS, TEX_ARC } from '../../scenes/BootScene'
import { damageArc } from '../area'
import type { Behavior, FireContext } from '../types'

const REACH = 64
const HALF_ARC = Math.PI / 3
const COS_HALF = Math.cos(HALF_ARC)
const KNOCK = 120

export function createMeleeArcBehavior(): Behavior {
  let flip = false
  return {
    fire({ host, weapon, stats, input }: FireContext): boolean {
      const p = host.player
      const fx = input.aimActive ? input.aimX : p.faceX
      const fy = input.aimActive ? input.aimY : p.faceY
      const base = Math.atan2(fy, fx)
      const n = Math.max(1, stats.projectiles)
      const reach = REACH * stats.area
      flip = !flip
      for (let k = 0; k < n; k++) {
        const a = base + (k / n) * Math.PI * 2
        const dx = Math.cos(a)
        const dy = Math.sin(a)
        damageArc(host, p.x, p.bodyY, dx, dy, COS_HALF, reach, stats.damage, KNOCK)
        const s = reach / ARC_RADIUS
        host.vfx.show(TEX_ARC, undefined, p.x, p.bodyY, a, s, flip ? -s : s, weapon.color, stats.durationSec + 0.1, {
          originX: 0,
          originY: 0.5,
          grow: 0.15,
        })
      }
      host.sfx('shoot')
      return true
    },
  }
}

