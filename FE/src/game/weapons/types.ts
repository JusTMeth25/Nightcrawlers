// Contracts between the weapon system, its behaviours and the scene that hosts them.
import type Phaser from 'phaser'
import type { OwnedWeapon, WeaponDef, WeaponLevelStats } from '@shared/types'
import type { SfxId } from '../audio/sfxIds'
import type { EnemyPool } from '../entities/EnemyPool'
import type { Grenades } from '../entities/Grenades'
import type { FxPool } from '../fx/FxPool'
import type { Player } from '../entities/Player'
import type { ProjectilePool } from '../entities/ProjectilePool'
import type { InputState } from '../input/InputState'
import type { Rng } from '../systems/rng'
import type { SpatialGrid } from '../systems/spatialGrid'
import type { Vec } from './targeting'

/** What the scene offers to weapons. */
export interface CombatHost {
  readonly gameScene: Phaser.Scene
  readonly enemies: EnemyPool
  readonly projectiles: ProjectilePool
  readonly grid: SpatialGrid
  readonly player: Player
  readonly rng: Rng
  /** short-lived visual effects */
  readonly vfx: FxPool
  readonly grenades: Grenades
  /** game seconds */
  readonly clock: number
  /** Applies a weapon hit (damage formula, numbers, knockback, kill handling). */
  damageEnemy(enemy: number, baseDamage: number, knockX: number, knockY: number): void
  /** Plays a sound effect (rate-limited by the audio system). */
  sfx(id: SfxId): void
}

export interface WeaponRuntime {
  owned: OwnedWeapon
  def: WeaponDef
  cooldownLeft: number
  /** VFX colour: the weapon's, or the character's once evolved */
  color: number
}

export interface FireContext {
  host: CombatHost
  weapon: WeaponRuntime
  stats: WeaponLevelStats
  /** null for `area` weapons and for `nearest` weapons without a target */
  dir: Vec | null
  input: InputState
}

export interface Behavior {
  /** Called when the cooldown is over. Return false to retry next frame (e.g. no target). */
  fire(ctx: FireContext): boolean
  /** Per-frame work for persistent effects (orbiting blades). */
  update?(host: CombatHost, weapon: WeaponRuntime, stats: WeaponLevelStats, dt: number): void
  destroy?(): void
}
