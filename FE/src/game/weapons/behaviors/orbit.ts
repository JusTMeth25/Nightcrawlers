// Monowire: `projectiles` blades circle the player for `durationSec`, at `speed` rad/s,
// on a radius scaled by `area`. Each enemy is hit at most once every HIT_EVERY_SEC per weapon.
import type Phaser from 'phaser'
import { TEX_BLADE } from '../../scenes/BootScene'
import type { Behavior, CombatHost, FireContext, WeaponRuntime } from '../types'
import type { WeaponLevelStats } from '@shared/types'

const BASE_RADIUS = 56
const BLADE_HIT_RADIUS = 12
const HIT_EVERY_SEC = 0.4
const MAX_BLADES = 12
const KNOCK = 90

export function createOrbitBehavior(scene: Phaser.Scene, enemyCap: number): Behavior {
  const blades: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_BLADES; i++) {
    blades.push(scene.add.image(0, 0, TEX_BLADE).setVisible(false).setBlendMode('ADD').setDepth(1e6))
  }
  const nextHit = new Float32Array(enemyCap)
  const found: number[] = []
  let activeLeft = 0
  let angle = 0

  return {
    fire({ stats }: FireContext): boolean {
      activeLeft = stats.durationSec
      return true
    },

    update(host: CombatHost, weapon: WeaponRuntime, stats: WeaponLevelStats, dt: number): void {
      const n = Math.min(MAX_BLADES, stats.projectiles)
      if (activeLeft <= 0) {
        for (const b of blades) b.setVisible(false)
        return
      }
      activeLeft -= dt
      angle += stats.speed * dt
      const r = BASE_RADIUS * stats.area
      const p = host.player
      const e = host.enemies
      for (let k = 0; k < MAX_BLADES; k++) {
        const blade = blades[k]
        if (k >= n) {
          blade.setVisible(false)
          continue
        }
        const a = angle + (k / n) * Math.PI * 2
        const bx = p.x + Math.cos(a) * r
        const by = p.bodyY + Math.sin(a) * r
        blade
          .setPosition(bx, by)
          .setRotation(a + Math.PI / 2)
          .setScale(stats.area)
          .setTint(weapon.color)
          .setVisible(true)
        const hits = host.grid.queryRadius(bx, by, BLADE_HIT_RADIUS * stats.area, found)
        for (let h = 0; h < hits; h++) {
          const i = found[h]
          if (!e.active[i] || nextHit[i] > host.clock) continue
          nextHit[i] = host.clock + HIT_EVERY_SEC
          // push outwards from the player
          const dx = e.x[i] - p.x
          const dy = e.y[i] - p.y
          const d = Math.hypot(dx, dy) || 1
          host.damageEnemy(i, stats.damage, (dx / d) * KNOCK, (dy / d) * KNOCK)
        }
      }
    },

    destroy(): void {
      for (const b of blades) b.destroy()
    },
  }
}
