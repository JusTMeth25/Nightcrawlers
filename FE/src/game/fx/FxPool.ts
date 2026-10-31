// Short-lived visual effects (explosions, beams, slashes, afterimages, telegraphs) from one
// preallocated pool of images. Each effect fades out over its life and may grow while it does.
// Driven by game time from the simulation step, so effects freeze while the game is paused.
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'
import { RING_RADIUS, TEX_RING } from '../scenes/BootScene'

const POOL = 192

export interface FxOptions {
  /** extra scale reached at the end of the life (0 = constant size) */
  grow?: number
  originX?: number
  originY?: number
  /** starting alpha */
  alpha?: number
  /** additive glow (default true) */
  add?: boolean
  /** keep full alpha until this share of the life is left (telegraph pulses) */
  hold?: number
  depth?: number
}

export class FxPool {
  private readonly images: Phaser.GameObjects.Image[] = []
  private readonly life = new Float32Array(POOL)
  private readonly maxLife = new Float32Array(POOL)
  private readonly sx = new Float32Array(POOL)
  private readonly sy = new Float32Array(POOL)
  private readonly grow = new Float32Array(POOL)
  private readonly alpha0 = new Float32Array(POOL)
  private readonly hold = new Float32Array(POOL)
  private cursor = 0

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < POOL; i++) {
      this.images.push(scene.add.image(0, 0, TEX_RING).setVisible(false).setDepth(layerDepth(LAYER.fx)))
    }
  }

  /** Shows `texture` (or an atlas frame) at (x, y); returns the image for extra tweaks. */
  show(
    texture: string,
    frame: string | undefined,
    x: number,
    y: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
    color: number,
    lifeSec: number,
    opts?: FxOptions,
  ): Phaser.GameObjects.Image {
    const i = this.cursor
    this.cursor = (i + 1) % POOL
    this.life[i] = lifeSec
    this.maxLife[i] = lifeSec > 0 ? lifeSec : 1
    this.sx[i] = scaleX
    this.sy[i] = scaleY
    this.grow[i] = opts?.grow ?? 0
    this.alpha0[i] = opts?.alpha ?? 1
    this.hold[i] = opts?.hold ?? 0
    const img = this.images[i]
    img
      .setTexture(texture, frame)
      .setOrigin(opts?.originX ?? 0.5, opts?.originY ?? 0.5)
      .setPosition(x, y)
      .setRotation(rotation)
      .setScale(scaleX, scaleY)
      .setTint(color)
      .setAlpha(this.alpha0[i])
      .setBlendMode(opts?.add === false ? 'NORMAL' : 'ADD')
      .setDepth(opts?.depth ?? layerDepth(LAYER.fx))
      .setFlipX(false)
      .setVisible(true)
    return img
  }

  /** Ring of `radius` world units (explosions, shockwaves, quickhack). */
  ring(x: number, y: number, radius: number, color: number, lifeSec: number, grow = 0.35): void {
    const s = radius / RING_RADIUS / (1 + grow)
    this.show(TEX_RING, undefined, x, y, 0, s, s, color, lifeSec, { grow })
  }

  update(dt: number): void {
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue
      this.life[i] -= dt
      const img = this.images[i]
      if (this.life[i] <= 0) {
        img.setVisible(false)
        continue
      }
      const f = this.life[i] / this.maxLife[i]
      const k = 1 + this.grow[i] * (1 - f)
      const fade = this.hold[i] > 0 && f > this.hold[i] ? 1 : this.hold[i] > 0 ? f / this.hold[i] : f
      img.setScale(this.sx[i] * k, this.sy[i] * k).setAlpha(this.alpha0[i] * fade)
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy()
    this.images.length = 0
  }
}
