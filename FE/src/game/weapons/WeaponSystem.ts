// Runs every owned weapon: cooldowns, targeting, behaviours and player-projectile hits.
import { getWeapon, weapons } from '@data/index'
import type { Stats, WeaponBehavior, WeaponId, WeaponLevelStats } from '@shared/types'
import { OWNER_PLAYER } from '../entities/ProjectilePool'
import type { InputState } from '../input/InputState'
import type { Inventory } from '../systems/inventory'
import { weaponStats } from '../systems/weapons'
import { BODY_OFFSET, ENEMY_RADIUS } from '../world/view'
import { createConeBehavior } from './behaviors/cone'
import { createOrbitBehavior } from './behaviors/orbit'
import { createProjectileBehavior } from './behaviors/projectile'
import { aimDirection, type Vec } from './targeting'
import type { Behavior, CombatHost, WeaponRuntime } from './types'

const NEAREST_RANGE = 420
const PROJECTILE_KNOCK = 60
const WEAPON_COLORS: Partial<Record<WeaponId, number>> = {
  pistol: 0xfff3a0,
  shotgun: 0xffa040,
  minigun: 0xffd166,
  monowire: 0x9dfcff,
  smart_pistol: 0x7cffb2,
}

/** Behaviours implemented so far: only these weapons are offered (M1: Tasks 13-16 add the rest). */
export const IMPLEMENTED_BEHAVIORS: ReadonlySet<WeaponBehavior> = new Set(['projectile', 'cone', 'orbit'])

export function implementedWeapons(): WeaponId[] {
  return weapons.filter((w) => IMPLEMENTED_BEHAVIORS.has(w.behavior)).map((w) => w.id)
}

interface Slot extends WeaponRuntime {
  behavior: Behavior
  stats: WeaponLevelStats
}

export class WeaponSystem {
  private readonly host: CombatHost
  private readonly characterColor: number
  private readonly slots: Slot[] = []
  private readonly found: number[] = []
  private readonly playerPos: Vec = { x: 0, y: 0 }
  private readonly nearestPos: Vec = { x: 0, y: 0 }
  private readonly lastMove: Vec = { x: 1, y: 0 }

  constructor(host: CombatHost, characterColor: string) {
    this.host = host
    this.characterColor = Number.parseInt(characterColor.replace('#', ''), 16) || 0xffffff
  }

  /** Mirrors the inventory; call after every card, evolution or stat change. */
  sync(inv: Inventory, stats: Stats): void {
    for (const owned of inv.weapons) {
      const def = getWeapon(owned.id)
      let slot = this.slots.find((s) => s.def.id === owned.id)
      if (!slot) {
        const behavior = this.createBehavior(def.behavior)
        if (!behavior) continue
        slot = { owned, def, behavior, cooldownLeft: 0, color: 0xffffff, stats: weaponStats(owned, stats) }
        this.slots.push(slot)
      }
      slot.owned = owned
      slot.stats = weaponStats(owned, stats)
      slot.color = owned.evolved ? this.characterColor : (WEAPON_COLORS[owned.id] ?? 0xffffff)
    }
  }

  private createBehavior(kind: WeaponBehavior): Behavior | null {
    switch (kind) {
      case 'projectile':
        return createProjectileBehavior()
      case 'cone':
        return createConeBehavior()
      case 'orbit':
        return createOrbitBehavior(this.host.gameScene, this.host.enemies.cap)
      default:
        // lob, melee_arc, drone, pierce_beam: plan Tasks 13-16
        return null
    }
  }

  update(dt: number, input: InputState): void {
    const host = this.host
    const p = host.player
    this.playerPos.x = p.x
    this.playerPos.y = p.bodyY
    this.lastMove.x = p.faceX
    this.lastMove.y = p.faceY
    let nearest: Vec | null | undefined
    for (const slot of this.slots) {
      slot.behavior.update?.(host, slot, slot.stats, dt)
      slot.cooldownLeft -= dt
      if (slot.cooldownLeft > 0) continue
      if (nearest === undefined) nearest = this.findNearest()
      const dir = aimDirection(slot.def.aim, input, this.playerPos, nearest, this.lastMove)
      if (slot.behavior.fire({ host, weapon: slot, stats: slot.stats, dir, input })) {
        slot.cooldownLeft = slot.stats.cooldownSec
      } else {
        slot.cooldownLeft = 0
      }
    }
    this.resolveProjectileHits()
  }

  private findNearest(): Vec | null {
    const i = this.host.grid.nearest(this.playerPos.x, this.playerPos.y, NEAREST_RANGE)
    if (i < 0) return null
    this.nearestPos.x = this.host.enemies.x[i]
    this.nearestPos.y = this.host.enemies.y[i] - BODY_OFFSET
    return this.nearestPos
  }

  private resolveProjectileHits(): void {
    const pr = this.host.projectiles
    const e = this.host.enemies
    for (let i = 0; i < pr.cap; i++) {
      if (!pr.active[i] || pr.owner[i] !== OWNER_PLAYER) continue
      const n = this.host.grid.queryRadius(pr.x[i], pr.y[i], pr.radius[i] + ENEMY_RADIUS, this.found)
      if (n === 0) continue
      const speed = Math.hypot(pr.vx[i], pr.vy[i]) || 1
      const kx = (pr.vx[i] / speed) * PROJECTILE_KNOCK
      const ky = (pr.vy[i] / speed) * PROJECTILE_KNOCK
      for (let k = 0; k < n && pr.active[i]; k++) {
        const enemy = this.found[k]
        if (!e.active[enemy] || pr.alreadyHit(i, enemy)) continue
        this.host.damageEnemy(enemy, pr.damage[i], kx, ky)
        pr.registerHit(i, enemy)
      }
    }
  }

  get owned(): readonly WeaponRuntime[] {
    return this.slots
  }

  destroy(): void {
    for (const s of this.slots) s.behavior.destroy?.()
    this.slots.length = 0
  }
}
