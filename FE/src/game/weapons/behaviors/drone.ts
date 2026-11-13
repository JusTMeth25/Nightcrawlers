// Drones: `projectiles` drones circle the player and each shoots its own nearest enemy when the
// weapon is ready. `durationSec` 99 in the data means "always deployed": shots live RANGE / speed.
import type Phaser from 'phaser'
import type { WeaponLevelStats } from '@shared/types'
import { OWNER_PLAYER } from '../../entities/ProjectilePool'
import { LAYER, layerDepth } from '../../render/depth'
import { TEX_DRONE } from '../../scenes/BootScene'
import { WEAPON_SCALE } from '../../render/weaponSlots'
import { SPRITE_SCALE } from '../../world/view'
import type { Behavior, CombatHost, FireContext, WeaponRuntime } from '../types'

const MAX_DRONES = 8
const ORBIT_RADIUS = 44
const ORBIT_SPEED = 1.6
const BOB = 4
const RANGE = 380
const SHOT_RADIUS = 3.5

export interface DroneBehavior extends Behavior {
  /** drones deployed on top of the weapon's `projectiles` (support skill) */
  extra: number
  /** hide the drones (a temporary drone squad that ended) */
  hide(): void
}

export function createDroneBehavior(scene: Phaser.Scene, phase = 0): DroneBehavior {
  // the drone sprite from the weapons atlas when available, the neon placeholder otherwise
  const art = scene.textures.exists('weapons')
  const sprites: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_DRONES; i++) {
    const img = art
      ? scene.add.image(0, 0, 'weapons', 'weapon_drone_base').setScale(SPRITE_SCALE * WEAPON_SCALE.drone)
      : scene.add.image(0, 0, TEX_DRONE).setBlendMode('ADD')
    sprites.push(img.setVisible(false).setDepth(layerDepth(LAYER.fx)))
  }
  let evolvedFrame = false
  const dx = new Float32Array(MAX_DRONES)
  const dy = new Float32Array(MAX_DRONES)
  let angle = phase
  let time = 0
  let count = 0

  const behavior: DroneBehavior = {
    extra: 0,

    update(host: CombatHost, weapon: WeaponRuntime, stats: WeaponLevelStats, dt: number): void {
      count = Math.min(MAX_DRONES, stats.projectiles + behavior.extra)
      if (art && weapon.owned.evolved !== evolvedFrame) {
        evolvedFrame = weapon.owned.evolved
        for (const d of sprites) d.setFrame(evolvedFrame ? 'weapon_drone_evo' : 'weapon_drone_base')
      }
      angle += ORBIT_SPEED * dt
      time += dt
      const p = host.player
      for (let k = 0; k < MAX_DRONES; k++) {
        const s = sprites[k]
        if (k >= count) {
          if (s.visible) s.setVisible(false)
          continue
        }
        const a = angle + (k / count) * Math.PI * 2
        dx[k] = p.x + Math.cos(a) * ORBIT_RADIUS
        dy[k] = p.bodyY - 10 + Math.sin(a) * ORBIT_RADIUS * 0.6 + Math.sin(time * 5 + k) * BOB
        if (art) s.setPosition(dx[k], dy[k]).setVisible(true)
        else s.setPosition(dx[k], dy[k]).setTint(weapon.color).setVisible(true)
      }
    },

    fire({ host, weapon, stats }: FireContext): boolean {
      const e = host.enemies
      let fired = false
      const life = RANGE / Math.max(1, stats.speed)
      for (let k = 0; k < count; k++) {
        const target = host.grid.nearest(dx[k], dy[k], RANGE)
        if (target < 0) continue
        const tx = e.x[target] - dx[k]
        const ty = e.bodyY(target) - dy[k]
        const d = Math.hypot(tx, ty) || 1
        host.projectiles.fire(
          OWNER_PLAYER,
          dx[k],
          dy[k],
          (tx / d) * stats.speed,
          (ty / d) * stats.speed,
          life,
          stats.damage,
          stats.pierce,
          SHOT_RADIUS * stats.area,
          weapon.color,
        )
        fired = true
      }
      if (fired) host.sfx('shoot')
      return fired
    },

    hide(): void {
      count = 0
      for (const s of sprites) s.setVisible(false)
    },

    destroy(): void {
      for (const s of sprites) s.destroy()
      sprites.length = 0
    },
  }
  return behavior
}
