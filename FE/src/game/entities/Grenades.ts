// Lobbed grenades (grenade launcher, explosive barrage, cluster grenade): they fly in an arc to a
// point and explode there. A grenade with `split` > 0 bursts into that many bomblets on landing.
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'
import { TEX_GRENADE } from '../scenes/BootScene'
import { pointInRing, type MutablePoint } from '../systems/hitShapes'
import { damageCircle } from '../weapons/area'
import type { CombatHost } from '../weapons/types'

const ARC_HEIGHT = 40
const EXPLOSION_KNOCK = 140
const EXPLOSION_FX_SEC = 0.3
const BOMBLET_FLIGHT_SEC = 0.35
const BOMBLET_MIN_R = 30
const BOMBLET_MAX_R = 90

export class Grenades {
  readonly cap: number
  private readonly sx: Float32Array
  private readonly sy: Float32Array
  private readonly tx: Float32Array
  private readonly ty: Float32Array
  private readonly t: Float32Array
  private readonly dur: Float32Array
  private readonly damage: Float32Array
  private readonly radius: Float32Array
  private readonly color: Uint32Array
  private readonly split: Uint8Array
  private readonly active: Uint8Array
  private readonly sprites: Phaser.GameObjects.Image[] = []
  private readonly point: MutablePoint = { x: 0, y: 0 }
  private cursor = 0

  constructor(scene: Phaser.Scene, cap = 96) {
    this.cap = cap
    this.sx = new Float32Array(cap)
    this.sy = new Float32Array(cap)
    this.tx = new Float32Array(cap)
    this.ty = new Float32Array(cap)
    this.t = new Float32Array(cap)
    this.dur = new Float32Array(cap)
    this.damage = new Float32Array(cap)
    this.radius = new Float32Array(cap)
    this.color = new Uint32Array(cap)
    this.split = new Uint8Array(cap)
    this.active = new Uint8Array(cap)
    for (let i = 0; i < cap; i++) {
      this.sprites.push(scene.add.image(0, 0, TEX_GRENADE).setVisible(false).setDepth(layerDepth(LAYER.fx)).setBlendMode('ADD'))
    }
  }

  /** Throws a grenade from (sx, sy) to (tx, ty); both at body height. Dropped when the pool is full. */
  throw(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    flightSec: number,
    damage: number,
    radius: number,
    color: number,
    split = 0,
  ): void {
    let i = -1
    for (let k = 0; k < this.cap; k++) {
      const j = (this.cursor + k) % this.cap
      if (!this.active[j]) {
        i = j
        break
      }
    }
    if (i < 0) return
    this.cursor = (i + 1) % this.cap
    this.active[i] = 1
    this.sx[i] = sx
    this.sy[i] = sy
    this.tx[i] = tx
    this.ty[i] = ty
    this.t[i] = 0
    this.dur[i] = Math.max(0.05, flightSec)
    this.damage[i] = damage
    this.radius[i] = radius
    this.color[i] = color
    this.split[i] = split
    this.sprites[i].setPosition(sx, sy).setTint(color).setVisible(true)
  }

  update(dt: number, host: CombatHost): void {
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue
      this.t[i] += dt
      const f = Math.min(1, this.t[i] / this.dur[i])
      const x = this.sx[i] + (this.tx[i] - this.sx[i]) * f
      const y = this.sy[i] + (this.ty[i] - this.sy[i]) * f - Math.sin(f * Math.PI) * ARC_HEIGHT
      this.sprites[i].setPosition(x, y)
      if (f < 1) continue
      this.active[i] = 0
      this.sprites[i].setVisible(false)
      this.explode(i, host)
    }
  }

  private explode(i: number, host: CombatHost): void {
    const x = this.tx[i]
    const y = this.ty[i]
    host.vfx.ring(x, y, this.radius[i], this.color[i], EXPLOSION_FX_SEC)
    host.sfx('explode')
    damageCircle(host, x, y, this.radius[i], this.damage[i], EXPLOSION_KNOCK)
    const n = this.split[i]
    for (let k = 0; k < n; k++) {
      const p = pointInRing(host.rng, x, y, BOMBLET_MIN_R, BOMBLET_MAX_R, this.point)
      this.throw(x, y, p.x, p.y, BOMBLET_FLIGHT_SEC, this.damage[i], this.radius[i] * 0.6, this.color[i], 0)
    }
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy()
    this.sprites.length = 0
  }
}
