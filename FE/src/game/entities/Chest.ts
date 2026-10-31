// Elite and boss chests: they lie where the enemy died and open on contact.
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'

const MAX_CHESTS = 8
const TEX_CHEST = 'tex_chest'
const OPEN_RADIUS = 22

export class Chests {
  private readonly sprites: Phaser.GameObjects.Image[] = []
  private readonly x = new Float32Array(MAX_CHESTS)
  private readonly y = new Float32Array(MAX_CHESTS)
  private readonly active = new Uint8Array(MAX_CHESTS)
  private bob = 0

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEX_CHEST)) {
      const g = scene.make.graphics({}, false)
      g.fillStyle(0xf5e663, 0.15)
      g.fillRoundedRect(0, 0, 32, 26, 6)
      g.fillStyle(0x1a1726, 1)
      g.fillRect(4, 6, 24, 16)
      g.lineStyle(2, 0xf5e663, 1)
      g.strokeRect(4, 6, 24, 16)
      g.lineBetween(4, 12, 28, 12)
      g.fillStyle(0xff2a6d, 1)
      g.fillRect(14, 10, 4, 5)
      g.generateTexture(TEX_CHEST, 32, 26)
      g.destroy()
    }
    for (let i = 0; i < MAX_CHESTS; i++) {
      this.sprites.push(scene.add.image(0, 0, TEX_CHEST).setOrigin(0.5, 1).setDepth(layerDepth(LAYER.pickup) + 1).setVisible(false))
    }
  }

  /** A chest at the feet position; with every slot taken the chest opens at once. */
  place(x: number, y: number): boolean {
    for (let i = 0; i < MAX_CHESTS; i++) {
      if (this.active[i]) continue
      this.active[i] = 1
      this.x[i] = x
      this.y[i] = y
      this.sprites[i].setPosition(x, y).setVisible(true)
      return true
    }
    return false
  }

  /** Calls `open` for every chest the player touches. */
  update(dt: number, px: number, py: number, open: () => void): void {
    this.bob += dt
    const r2 = OPEN_RADIUS * OPEN_RADIUS
    for (let i = 0; i < MAX_CHESTS; i++) {
      if (!this.active[i]) continue
      this.sprites[i].setY(this.y[i] - Math.abs(Math.sin(this.bob * 4)) * 3)
      if ((px - this.x[i]) ** 2 + (py - this.y[i]) ** 2 > r2) continue
      this.active[i] = 0
      this.sprites[i].setVisible(false)
      open()
    }
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy()
  }
}
