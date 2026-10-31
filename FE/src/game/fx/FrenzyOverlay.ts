// Cyberpsychosis overlay (spec 2.5): red wash, scanlines and jittering glitch bars while the
// frenzy lasts. Screen-space objects (scroll factor 0) sized to cover the view at any zoom.
// Updated from the simulation step, so it freezes with the game.
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'
import type { Rng } from '../systems/rng'

const TEX_SCANLINES = 'tex_scanlines'
const BARS = 4
const GLITCH_EVERY_SEC = 0.07
const RED = 0xff0033

export class FrenzyOverlay {
  private readonly wash: Phaser.GameObjects.Rectangle
  private readonly lines: Phaser.GameObjects.TileSprite
  private readonly bars: Phaser.GameObjects.Rectangle[] = []
  private readonly cam: Phaser.Cameras.Scene2D.Camera
  private readonly rng: Rng
  private glitchIn = 0
  private time = 0
  private shown = false

  constructor(scene: Phaser.Scene, cosmeticRng: Rng) {
    this.cam = scene.cameras.main
    this.rng = cosmeticRng
    if (!scene.textures.exists(TEX_SCANLINES)) {
      const g = scene.make.graphics({}, false)
      g.fillStyle(0x000000, 0.5)
      g.fillRect(0, 0, 4, 1)
      g.generateTexture(TEX_SCANLINES, 4, 3)
      g.destroy()
    }
    const depth = layerDepth(LAYER.text) + 500
    this.wash = scene.add.rectangle(0, 0, 4, 4, RED, 0.16).setScrollFactor(0).setDepth(depth).setVisible(false)
    this.lines = scene.add.tileSprite(0, 0, 4, 4, TEX_SCANLINES).setScrollFactor(0).setDepth(depth + 1).setVisible(false)
    for (let i = 0; i < BARS; i++) {
      this.bars.push(scene.add.rectangle(0, 0, 4, 4, RED, 0.3).setScrollFactor(0).setDepth(depth + 2).setVisible(false))
    }
  }

  update(dt: number, active: boolean): void {
    if (!active) {
      if (this.shown) this.setVisible(false)
      return
    }
    const cam = this.cam
    const w = cam.width / cam.zoom
    const h = cam.height / cam.zoom
    const cx = cam.width / 2
    const cy = cam.height / 2
    if (!this.shown) this.setVisible(true)
    this.time += dt
    // the wash breathes so the frenzy reads as unstable
    this.wash.setPosition(cx, cy).setSize(w + 8, h + 8).setFillStyle(RED, 0.13 + 0.05 * Math.sin(this.time * 9))
    this.lines.setPosition(cx, cy).setSize(w + 8, h + 8)
    this.lines.tilePositionY = this.time * 12
    this.glitchIn -= dt
    if (this.glitchIn > 0) return
    this.glitchIn = GLITCH_EVERY_SEC
    for (const bar of this.bars) {
      const show = this.rng.next() < 0.6
      bar.setVisible(show)
      if (!show) continue
      const bw = w * (0.2 + this.rng.next() * 0.8)
      const bh = 2 + this.rng.next() * 10
      const bx = cx + (this.rng.next() - 0.5) * w
      const by = cy + (this.rng.next() - 0.5) * h
      bar.setPosition(bx, by).setSize(bw, bh).setFillStyle(this.rng.next() < 0.5 ? RED : 0x05d9e8, 0.15 + this.rng.next() * 0.25)
    }
  }

  private setVisible(v: boolean): void {
    this.shown = v
    this.wash.setVisible(v)
    this.lines.setVisible(v)
    for (const bar of this.bars) bar.setVisible(v && bar.visible)
  }

  destroy(): void {
    this.wash.destroy()
    this.lines.destroy()
    for (const b of this.bars) b.destroy()
  }
}
