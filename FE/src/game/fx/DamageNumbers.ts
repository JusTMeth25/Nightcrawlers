// Floating damage numbers from a fixed pool of Text objects (oldest reused when all are busy).
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'

const POOL = 48
const LIFE_SEC = 0.6
const RISE = 28

export class DamageNumbers {
  private readonly texts: Phaser.GameObjects.Text[] = []
  private readonly life = new Float32Array(POOL)
  private cursor = 0

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < POOL; i++) {
      this.texts.push(
        scene.add
          .text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(0.5, 1)
          .setDepth(layerDepth(LAYER.text))
          .setVisible(false),
      )
    }
  }

  show(x: number, y: number, amount: number, crit: boolean): void {
    const i = this.cursor
    this.cursor = (i + 1) % POOL
    this.life[i] = LIFE_SEC
    this.texts[i]
      .setText(String(Math.round(amount)))
      .setColor(crit ? '#ffd447' : '#ffffff')
      .setScale(crit ? 1.4 : 1)
      .setPosition(x, y)
      .setAlpha(1)
      .setVisible(true)
  }

  update(dt: number): void {
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue
      this.life[i] -= dt
      const t = this.texts[i]
      if (this.life[i] <= 0) {
        t.setVisible(false)
        continue
      }
      t.y -= (RISE / LIFE_SEC) * dt
      t.setAlpha(Math.min(1, (this.life[i] / LIFE_SEC) * 2))
    }
  }

  destroy(): void {
    for (const t of this.texts) t.destroy()
  }
}
