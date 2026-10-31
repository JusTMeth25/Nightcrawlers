// Preallocated enemies (struct of arrays + one sprite each). No allocation in the frame loop.
// Behaviours: chase, kite (keeps ranged.range and shoots), charger (short dash every 4 s).
// Bosses chase until the BossController (plan Task 14) takes over.
import Phaser from 'phaser'
import { balance, enemies as enemyDefs } from '@data/index'
import type { EnemyDef } from '@shared/types'
import { animTable, dirOf, type AnimTable } from '../render/animTable'
import { drawPlaceholder } from '../render/placeholders'
import type { SpatialGrid } from '../systems/spatialGrid'
import { BODY_OFFSET, ENEMY_RADIUS, SPRITE_SCALE } from '../world/view'

const CHARGE_EVERY_SEC = 4
const CHARGE_WINDUP_SEC = 0.35
const CHARGE_SEC = 0.6
const CHARGE_SPEED_MULT = 4
const KNOCKBACK_DAMP = 8
const HIT_FLASH_SEC = 0.08
const SEPARATION_RADIUS = ENEMY_RADIUS * 1.6
const SEPARATION_PUSH = 110
const MAX_NEIGHBOURS = 6
const ELITE_TINT = 0x8a2be2
const BOSS_SCALE = 1.6

/** charger states */
const WALK = 0
const WINDUP = 1
const CHARGE = 2

export interface SpawnOptions {
  elite?: boolean
  boss?: boolean
  hpMult?: number
  damageMult?: number
}

export interface EnemyShot {
  (fromX: number, fromY: number, dirX: number, dirY: number, def: EnemyDef, damageMult: number): void
}

export class EnemyPool {
  readonly cap: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly hp: Float32Array
  readonly maxHp: Float32Array
  readonly damage: Float32Array
  readonly active: Uint8Array
  readonly elite: Uint8Array
  readonly boss: Uint8Array
  readonly defIndex: Uint8Array
  readonly sprites: Phaser.GameObjects.Sprite[] = []
  /** global slow (Sandevistan): 1 = normal speed */
  slow = 1
  alive = 0
  private readonly kbx: Float32Array
  private readonly kby: Float32Array
  private readonly timer: Float32Array
  private readonly state: Uint8Array
  private readonly cdx: Float32Array
  private readonly cdy: Float32Array
  private readonly flash: Float32Array
  private readonly pendingDt: Float32Array
  private readonly dmgMult: Float32Array
  private readonly tables: (AnimTable | null)[]
  private readonly textures: string[]
  private readonly neighbours: number[] = []

  constructor(scene: Phaser.Scene, cap: number, available: Set<string>) {
    this.cap = cap
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.hp = new Float32Array(cap)
    this.maxHp = new Float32Array(cap)
    this.damage = new Float32Array(cap)
    this.active = new Uint8Array(cap)
    this.elite = new Uint8Array(cap)
    this.boss = new Uint8Array(cap)
    this.defIndex = new Uint8Array(cap)
    this.kbx = new Float32Array(cap)
    this.kby = new Float32Array(cap)
    this.timer = new Float32Array(cap)
    this.state = new Uint8Array(cap)
    this.cdx = new Float32Array(cap)
    this.cdy = new Float32Array(cap)
    this.flash = new Float32Array(cap)
    this.pendingDt = new Float32Array(cap)
    this.dmgMult = new Float32Array(cap)
    this.tables = enemyDefs.map((d) => animTable(available, d.spriteKey))
    this.textures = enemyDefs.map((d, i) =>
      this.tables[i] ? 'enemies' : drawPlaceholder(scene, `enemy_${d.id}`, d.color, d.behavior === 'boss' ? 56 : 28, d.behavior === 'boss' ? 'boss' : 'enemy'),
    )
    for (let i = 0; i < cap; i++) {
      this.sprites.push(scene.add.sprite(0, 0, this.textures[0]).setVisible(false).setActive(false))
    }
  }

  def(i: number): EnemyDef {
    return enemyDefs[this.defIndex[i]]
  }

  /** Index of a free slot, or -1 when the pool is full. */
  private freeSlot(): number {
    for (let i = 0; i < this.cap; i++) if (!this.active[i]) return i
    return -1
  }

  /** Farthest non-boss enemy from a point: recycled when the cap is reached (spec 2.7). */
  farthestFrom(px: number, py: number): number {
    let best = -1
    let bestD = -1
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i] || this.boss[i]) continue
      const d = (this.x[i] - px) ** 2 + (this.y[i] - py) ** 2
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  spawn(def: EnemyDef, x: number, y: number, opts: SpawnOptions, px: number, py: number): number {
    let i = this.freeSlot()
    if (i === -1) {
      i = this.farthestFrom(px, py)
      if (i === -1) return -1
      if (!opts.elite && !opts.boss) {
        // over the cap: move the farthest enemy instead of creating one
        this.x[i] = x
        this.y[i] = y
        return i
      }
      this.release(i)
    }
    const di = enemyDefs.indexOf(def)
    const elite = opts.elite ? 1 : 0
    const boss = opts.boss ? 1 : 0
    const hp = def.hp * (opts.hpMult ?? 1) * (elite ? balance.elite.hpMult : 1)
    this.active[i] = 1
    this.alive++
    this.defIndex[i] = di
    this.elite[i] = elite
    this.boss[i] = boss
    this.x[i] = x
    this.y[i] = y
    this.hp[i] = hp
    this.maxHp[i] = hp
    this.dmgMult[i] = opts.damageMult ?? 1
    this.damage[i] = def.damage * this.dmgMult[i]
    this.kbx[i] = 0
    this.kby[i] = 0
    this.state[i] = WALK
    this.timer[i] = def.behavior === 'charger' ? CHARGE_EVERY_SEC : (def.ranged?.cooldownSec ?? 0)
    this.flash[i] = 0
    this.pendingDt[i] = 0
    const s = this.sprites[i]
    const table = this.tables[di]
    const base = table ? SPRITE_SCALE : 1
    s.setTexture(this.textures[di])
    s.setScale(base * (elite ? balance.elite.scale : 1) * (boss ? BOSS_SCALE : 1))
    s.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY)
    if (elite) s.setTint(ELITE_TINT).setTintMode(Phaser.TintModes.ADD)
    s.setPosition(x, y).setVisible(true).setActive(true)
    const walk = table?.down.walk
    if (walk) s.play(walk)
    return i
  }

  release(i: number): void {
    if (!this.active[i]) return
    this.active[i] = 0
    this.alive--
    const s = this.sprites[i]
    s.anims.stop()
    s.setVisible(false).setActive(false)
  }

  /** Applies damage; returns true when the enemy dies (the caller handles drops, then release). */
  hit(i: number, amount: number, kx: number, ky: number): boolean {
    this.hp[i] -= amount
    this.kbx[i] += kx
    this.kby[i] += ky
    this.flash[i] = HIT_FLASH_SEC
    return this.hp[i] <= 0
  }

  /**
   * `inView` is the visible rectangle grown by a margin: enemies outside it think every 3rd frame.
   * The grid must hold the enemies' body centres (index = enemy index).
   */
  update(
    dt: number,
    frame: number,
    px: number,
    py: number,
    inView: Phaser.Geom.Rectangle,
    grid: SpatialGrid,
    shoot: EnemyShot,
  ): void {
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue
      const s = this.sprites[i]
      // hit flash runs every frame so it stays visible
      if (this.flash[i] > 0) {
        this.flash[i] -= dt
        if (this.flash[i] > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
        else if (this.elite[i]) s.setTint(ELITE_TINT).setTintMode(Phaser.TintModes.ADD)
        else s.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY)
      }
      this.pendingDt[i] += dt
      const onScreen = inView.contains(this.x[i], this.y[i])
      if (!onScreen && (i + frame) % 3 !== 0) continue
      const step = Math.min(this.pendingDt[i], 0.3) * this.slow
      this.pendingDt[i] = 0
      this.think(i, step, px, py, shoot)
      if (onScreen) this.separate(i, step, grid)
      // knockback decays exponentially
      this.x[i] += this.kbx[i] * step
      this.y[i] += this.kby[i] * step
      const damp = Math.exp(-KNOCKBACK_DAMP * step)
      this.kbx[i] *= damp
      this.kby[i] *= damp
      s.setPosition(this.x[i], this.y[i])
      s.setDepth(this.y[i])
    }
  }

  private think(i: number, dt: number, px: number, py: number, shoot: EnemyShot): void {
    const def = this.def(i)
    const dx = px - this.x[i]
    const dy = py - this.y[i]
    const dist = Math.hypot(dx, dy) || 1
    const ux = dx / dist
    const uy = dy / dist
    let vx = ux
    let vy = uy
    let speed = def.speed
    if (def.behavior === 'kite' && def.ranged) {
      const r = def.ranged
      if (dist < r.range * 0.6) {
        vx = -ux
        vy = -uy
      } else if (dist < r.range * 0.9) {
        // strafe around the player
        vx = -uy
        vy = ux
        speed *= 0.5
      }
      this.timer[i] -= dt
      if (this.timer[i] <= 0 && dist <= r.range * 1.1) {
        this.timer[i] = r.cooldownSec
        shoot(this.x[i], this.y[i] - BODY_OFFSET, ux, uy, def, this.dmgMult[i])
      }
    } else if (def.behavior === 'charger') {
      this.timer[i] -= dt
      if (this.state[i] === WALK && this.timer[i] <= 0) {
        this.state[i] = WINDUP
        this.timer[i] = CHARGE_WINDUP_SEC
        this.cdx[i] = ux
        this.cdy[i] = uy
      } else if (this.state[i] === WINDUP) {
        speed = 0
        if (this.timer[i] <= 0) {
          this.state[i] = CHARGE
          this.timer[i] = CHARGE_SEC
        }
      } else if (this.state[i] === CHARGE) {
        vx = this.cdx[i]
        vy = this.cdy[i]
        speed *= CHARGE_SPEED_MULT
        if (this.timer[i] <= 0) {
          this.state[i] = WALK
          this.timer[i] = CHARGE_EVERY_SEC
        }
      }
    }
    this.x[i] += vx * speed * dt
    this.y[i] += vy * speed * dt
    const s = this.sprites[i]
    const table = this.tables[this.defIndex[i]]
    if (table) {
      const dir = dirOf(ux, uy)
      const key = table[dir].walk
      if (key && s.anims.currentAnim?.key !== key) s.play(key)
      s.setFlipX(dir === 'side' && ux < 0)
    }
  }

  private separate(i: number, dt: number, grid: SpatialGrid): void {
    const n = grid.queryRadius(this.x[i], this.y[i] - BODY_OFFSET, SEPARATION_RADIUS, this.neighbours)
    let pushX = 0
    let pushY = 0
    let used = 0
    for (let k = 0; k < n && used < MAX_NEIGHBOURS; k++) {
      const j = this.neighbours[k]
      if (j === i) continue
      used++
      let dx = this.x[i] - this.x[j]
      let dy = this.y[i] - this.y[j]
      const d = Math.hypot(dx, dy)
      if (d < 0.001) {
        // same spot: split them along a stable axis
        dx = i < j ? 1 : -1
        dy = 0
      } else {
        dx /= d
        dy /= d
      }
      const strength = 1 - Math.min(1, d / SEPARATION_RADIUS)
      pushX += dx * strength
      pushY += dy * strength
    }
    this.x[i] += pushX * SEPARATION_PUSH * dt
    this.y[i] += pushY * SEPARATION_PUSH * dt
  }

  /** Writes body centres into the grid (call once per frame before queries). */
  fillGrid(grid: SpatialGrid): void {
    grid.clear()
    for (let i = 0; i < this.cap; i++) if (this.active[i]) grid.insert(i, this.x[i], this.y[i] - BODY_OFFSET)
  }

  /** Pushes every enemy within `radius` away from a point (revival shockwave). */
  pushAway(cx: number, cy: number, radius: number, force: number): void {
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue
      const dx = this.x[i] - cx
      const dy = this.y[i] - cy
      const d = Math.hypot(dx, dy)
      if (d > radius || d < 0.001) continue
      this.kbx[i] += (dx / d) * force
      this.kby[i] += (dy / d) * force
    }
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy()
    this.sprites.length = 0
  }

}
