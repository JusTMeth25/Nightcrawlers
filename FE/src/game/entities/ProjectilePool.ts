// Preallocated projectiles for the player's weapons and for ranged enemies.
// Positions are at body height (the shooter's collision centre), like the grid entries.
import type Phaser from 'phaser'
import { TEX_DOT } from '../scenes/BootScene'
import { LAYER, layerDepth } from '../render/depth'

export const OWNER_PLAYER = 0
export const OWNER_ENEMY = 1
/** enemies remembered per projectile so piercing shots hit each enemy once */
const HIT_LOG = 8

export class ProjectilePool {
  readonly cap: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly life: Float32Array
  readonly damage: Float32Array
  readonly radius: Float32Array
  readonly pierce: Int16Array
  readonly owner: Uint8Array
  readonly active: Uint8Array
  readonly sprites: Phaser.GameObjects.Image[] = []
  alive = 0
  private readonly hits: Int32Array
  private readonly hitCount: Uint8Array
  private cursor = 0

  constructor(scene: Phaser.Scene, cap: number) {
    this.cap = cap
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.damage = new Float32Array(cap)
    this.radius = new Float32Array(cap)
    this.pierce = new Int16Array(cap)
    this.owner = new Uint8Array(cap)
    this.active = new Uint8Array(cap)
    this.hits = new Int32Array(cap * HIT_LOG)
    this.hitCount = new Uint8Array(cap)
    for (let i = 0; i < cap; i++) {
      this.sprites.push(scene.add.image(0, 0, TEX_DOT).setVisible(false).setDepth(layerDepth(LAYER.fx)).setBlendMode('ADD'))
    }
  }

  /** Returns the slot, or -1 when every slot is busy (the shot is dropped). */
  fire(
    owner: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    damage: number,
    pierce: number,
    radius: number,
    tint: number,
  ): number {
    let i = -1
    for (let k = 0; k < this.cap; k++) {
      const j = (this.cursor + k) % this.cap
      if (!this.active[j]) {
        i = j
        break
      }
    }
    if (i === -1) return -1
    this.cursor = (i + 1) % this.cap
    this.active[i] = 1
    this.alive++
    this.owner[i] = owner
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = life
    this.damage[i] = damage
    this.pierce[i] = Math.max(1, pierce)
    this.radius[i] = radius
    this.hitCount[i] = 0
    const s = this.sprites[i]
    // the dot texture has radius 8
    const r = radius / 8
    s.setPosition(x, y).setRotation(Math.atan2(vy, vx)).setScale(r * 1.8, r).setTint(tint).setVisible(true)
    return i
  }

  release(i: number): void {
    if (!this.active[i]) return
    this.active[i] = 0
    this.alive--
    this.sprites[i].setVisible(false)
  }

  /** Moves projectiles; enemy shots are scaled by `enemySlow` (Sandevistan). */
  update(dt: number, enemySlow: number): void {
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue
      const k = this.owner[i] === OWNER_ENEMY ? dt * enemySlow : dt
      this.life[i] -= k
      if (this.life[i] <= 0) {
        this.release(i)
        continue
      }
      this.x[i] += this.vx[i] * k
      this.y[i] += this.vy[i] * k
      this.sprites[i].setPosition(this.x[i], this.y[i])
    }
  }

  alreadyHit(i: number, enemy: number): boolean {
    const base = i * HIT_LOG
    for (let k = 0; k < this.hitCount[i]; k++) if (this.hits[base + k] === enemy) return true
    return false
  }

  /** Records a hit and spends one pierce; releases the projectile when none is left. */
  registerHit(i: number, enemy: number): void {
    const n = this.hitCount[i]
    this.hits[i * HIT_LOG + (n % HIT_LOG)] = enemy
    if (n < HIT_LOG) this.hitCount[i] = n + 1
    this.pierce[i]--
    if (this.pierce[i] <= 0) this.release(i)
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy()
    this.sprites.length = 0
  }
}
