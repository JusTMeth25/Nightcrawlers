// Pickups on the floor: data fragments (XP), eurodollar bags, medkits, global magnet, EMP.
// Attracted within the magnet radius, collected within the pickup radius (spec 2.1, 2.8).
// Past MAX_FRAGMENTS fragments, new XP merges into one big fragment instead of a new sprite.
import type Phaser from 'phaser'
import { TEX_DOT, TEX_SHARD } from '../scenes/BootScene'
import { tracePolygon } from '../render/placeholders'
import { LAYER, layerDepth } from '../render/depth'

export const PICKUP_XP = 0
export const PICKUP_EURO = 1
export const PICKUP_MEDKIT = 2
export const PICKUP_MAGNET = 3
export const PICKUP_EMP = 4
export type PickupKind = 0 | 1 | 2 | 3 | 4

export const MAX_FRAGMENTS = 300
const PULL_SPEED = 320
const PULL_ACCEL = 900
const TEX_MEDKIT = 'tex_medkit'
const TEX_MAGNET = 'tex_magnet'
const TEX_EMP = 'tex_emp'

const LOOK: Record<PickupKind, { tex: string; tint: number; scale: number }> = {
  [PICKUP_XP]: { tex: TEX_SHARD, tint: 0x05d9e8, scale: 1 },
  [PICKUP_EURO]: { tex: TEX_DOT, tint: 0xffd447, scale: 1.1 },
  [PICKUP_MEDKIT]: { tex: TEX_MEDKIT, tint: 0xffffff, scale: 1 },
  [PICKUP_MAGNET]: { tex: TEX_MAGNET, tint: 0xffffff, scale: 1 },
  [PICKUP_EMP]: { tex: TEX_EMP, tint: 0xffffff, scale: 1 },
}

export type CollectFn = (kind: PickupKind, value: number) => void

export class PickupPool {
  readonly cap: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly value: Float32Array
  readonly kind: Uint8Array
  readonly active: Uint8Array
  fragments = 0
  private readonly speed: Float32Array
  private readonly pulled: Uint8Array
  private readonly sprites: Phaser.GameObjects.Image[] = []
  private big = -1
  private cursor = 0

  constructor(scene: Phaser.Scene, cap: number) {
    this.cap = cap
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.value = new Float32Array(cap)
    this.kind = new Uint8Array(cap)
    this.active = new Uint8Array(cap)
    this.speed = new Float32Array(cap)
    this.pulled = new Uint8Array(cap)
    makeTextures(scene)
    for (let i = 0; i < cap; i++) this.sprites.push(scene.add.image(0, 0, TEX_SHARD).setVisible(false).setDepth(layerDepth(LAYER.pickup)))
  }

  drop(kind: PickupKind, x: number, y: number, value: number): void {
    if (kind === PICKUP_XP && this.fragments >= MAX_FRAGMENTS) {
      if (this.big < 0 || !this.active[this.big] || this.kind[this.big] !== PICKUP_XP) this.big = this.oldestFragment()
      if (this.big >= 0) {
        this.value[this.big] += value
        this.sprites[this.big].setScale(1.8).setTint(0xff2a6d)
        return
      }
    }
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
    this.kind[i] = kind
    this.x[i] = x
    this.y[i] = y
    this.value[i] = value
    this.speed[i] = 0
    this.pulled[i] = 0
    if (kind === PICKUP_XP) this.fragments++
    const look = LOOK[kind]
    this.sprites[i].setTexture(look.tex).setTint(look.tint).setScale(look.scale).setPosition(x, y).setVisible(true)
  }

  private oldestFragment(): number {
    for (let k = 0; k < this.cap; k++) {
      const j = (this.cursor + k) % this.cap
      if (this.active[j] && this.kind[j] === PICKUP_XP) return j
    }
    return -1
  }

  /** Global magnet: every fragment flies to the player. */
  magnetAll(): void {
    for (let i = 0; i < this.cap; i++) if (this.active[i] && this.kind[i] === PICKUP_XP) this.pulled[i] = 1
  }

  /** `view` (optional): pickups outside it are hidden so the renderer skips them. */
  update(
    dt: number,
    px: number,
    py: number,
    magnet: number,
    collectRadius: number,
    collect: CollectFn,
    view?: { contains(x: number, y: number): boolean },
  ): void {
    const m2 = magnet * magnet
    const c2 = collectRadius * collectRadius
    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue
      if (view) {
        const show = view.contains(this.x[i], this.y[i])
        const sp = this.sprites[i]
        if (sp.visible !== show) sp.setVisible(show)
      }
      const dx = px - this.x[i]
      const dy = py - this.y[i]
      const d2 = dx * dx + dy * dy
      if (d2 <= c2) {
        const kind = this.kind[i] as PickupKind
        const value = this.value[i]
        this.release(i)
        collect(kind, value)
        continue
      }
      if (!this.pulled[i] && d2 <= m2) this.pulled[i] = 1
      if (!this.pulled[i]) continue
      this.speed[i] = Math.max(this.speed[i], PULL_SPEED) + PULL_ACCEL * dt
      const d = Math.sqrt(d2)
      const step = Math.min(d, this.speed[i] * dt)
      this.x[i] += (dx / d) * step
      this.y[i] += (dy / d) * step
      this.sprites[i].setPosition(this.x[i], this.y[i])
    }
  }

  private release(i: number): void {
    this.active[i] = 0
    if (this.kind[i] === PICKUP_XP) this.fragments--
    if (i === this.big) this.big = -1
    this.sprites[i].setVisible(false)
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy()
  }
}

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX_MEDKIT)) return
  const g = scene.make.graphics({}, false)
  g.fillStyle(0xffffff, 1)
  g.fillRoundedRect(0, 0, 14, 14, 3)
  g.fillStyle(0xff2a6d, 1)
  g.fillRect(5, 2, 4, 10)
  g.fillRect(2, 5, 10, 4)
  g.generateTexture(TEX_MEDKIT, 14, 14)
  g.clear()
  g.lineStyle(3, 0x05d9e8, 1)
  g.beginPath()
  g.arc(8, 8, 5, Math.PI, 0, false)
  g.strokePath()
  g.fillStyle(0xff2a6d, 1)
  g.fillRect(1, 8, 5, 5)
  g.fillRect(10, 8, 5, 5)
  g.generateTexture(TEX_MAGNET, 16, 16)
  g.clear()
  g.fillStyle(0xd1f7ff, 0.3)
  g.fillCircle(8, 8, 8)
  g.fillStyle(0xd1f7ff, 1)
  tracePolygon(g, [
    { x: 9, y: 1 },
    { x: 4, y: 9 },
    { x: 8, y: 9 },
    { x: 7, y: 15 },
    { x: 12, y: 6 },
    { x: 8, y: 6 },
  ]).fillPath()
  g.generateTexture(TEX_EMP, 16, 16)
  g.destroy()
}
