// What a boss attack pattern may use, and the per-boss state it keeps.
import type { EnemyId } from '@shared/types'
import type { SfxId } from '../../audio/sfxIds'
import type { EnemyPool } from '../../entities/EnemyPool'
import type { Player } from '../../entities/Player'
import type { ProjectilePool } from '../../entities/ProjectilePool'
import type { FxPool } from '../../fx/FxPool'
import type { ScreenFx } from '../../fx/ScreenFx'
import type { Rng } from '../../systems/rng'

export interface BossHost {
  readonly enemies: EnemyPool
  readonly player: Player
  readonly projectiles: ProjectilePool
  readonly vfx: FxPool
  readonly screen: ScreenFx
  readonly rng: Rng
  /** Spawns `count` normal enemies on a circle of `radius` around (x, y) (feet). */
  spawnAround(enemyId: EnemyId, x: number, y: number, count: number, radius: number): void
  /** Raw damage to the player (armor and i-frames apply). */
  hurtPlayer(raw: number): void
  sfx(id: SfxId): void
}

/** One boss being driven; `dirX/dirY` is the attack direction locked at the telegraph. */
export interface BossState {
  slot: number
  dirX: number
  dirY: number
}

export interface Pattern {
  /** Warning shown for TELEGRAPH_SEC: the attack hits exactly what it shows. */
  telegraph(host: BossHost, boss: BossState, sec: number): void
  /** The attack starts. */
  attack(host: BossHost, boss: BossState): void
  /** Every step while the attack lasts (dt already slowed by Sandevistan). */
  update?(host: BossHost, boss: BossState, dt: number): void
}
