// Sandevistan (David): every enemy and enemy shot runs at `slowFactor` speed for the duration,
// the player dashes `dashDistance` along the movement and leaves fading afterimages.
import type { SkillDef } from '@shared/types'
import type { Skill, SkillHost } from './types'

const AFTERIMAGE_EVERY_SEC = 0.06
const AFTERIMAGE_LIFE_SEC = 0.35

export function createSandevistan(def: SkillDef): Skill {
  const slowFactor = def.params.slowFactor ?? 0.3
  const dashDistance = def.params.dashDistance ?? 160
  let left = 0
  let ghostIn = 0

  const skill: Skill = {
    get active() {
      return left > 0
    },

    activate(host: SkillHost, durationSec: number): void {
      left = durationSec
      ghostIn = 0
      host.enemies.slow = slowFactor
      const p = host.player
      p.dash(p.faceX, p.faceY, dashDistance)
      host.screen.flash(0.15, host.characterColor)
    },

    update(host: SkillHost, dt: number): void {
      if (left <= 0) return
      left -= dt
      if (left <= 0) {
        skill.stop(host)
        return
      }
      ghostIn -= dt
      const p = host.player
      if (ghostIn > 0 || (!p.moving && !p.dashing)) return
      ghostIn = AFTERIMAGE_EVERY_SEC
      const s = p.sprite
      const frame = s.frame
      host.vfx
        .show(s.texture.key, frame.name, p.x, p.y, 0, s.scaleX, s.scaleY, host.characterColor, AFTERIMAGE_LIFE_SEC, {
          originX: frame.customPivot ? frame.pivotX : s.originX,
          originY: frame.customPivot ? frame.pivotY : s.originY,
          alpha: 0.55,
          depth: s.depth - 1,
        })
        .setFlipX(s.flipX)
    },

    stop(host: SkillHost): void {
      left = 0
      host.enemies.slow = 1
    },
  }
  return skill
}
