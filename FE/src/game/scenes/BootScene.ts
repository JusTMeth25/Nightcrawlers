// First scene: builds the tiny generated textures every other scene relies on, then loads assets.
import Phaser from 'phaser'
import { tracePolygon } from '../render/placeholders'

export const BOOT_SCENE_KEY = 'Boot'
export const TEX_DOT = 'tex_dot'
export const TEX_SHARD = 'tex_shard'
export const TEX_BLADE = 'tex_blade'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE_KEY)
  }

  create(): void {
    const g = this.make.graphics({}, false)
    // soft round bullet, tinted per weapon
    g.fillStyle(0xffffff, 0.25)
    g.fillCircle(8, 8, 8)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(8, 8, 4)
    g.generateTexture(TEX_DOT, 16, 16)
    g.clear()
    // data fragment (XP)
    g.fillStyle(0xffffff, 0.3)
    tracePolygon(g, [{ x: 6, y: 0 }, { x: 12, y: 6 }, { x: 6, y: 12 }, { x: 0, y: 6 }]).fillPath()
    g.fillStyle(0xffffff, 1)
    tracePolygon(g, [{ x: 6, y: 2 }, { x: 10, y: 6 }, { x: 6, y: 10 }, { x: 2, y: 6 }]).fillPath()
    g.generateTexture(TEX_SHARD, 12, 12)
    g.clear()
    // monowire blade: thin glowing segment
    g.fillStyle(0xffffff, 0.3)
    g.fillRect(0, 0, 28, 6)
    g.fillStyle(0xffffff, 1)
    g.fillRect(2, 2, 24, 2)
    g.generateTexture(TEX_BLADE, 28, 6)
    g.destroy()
    this.scene.start('Preload')
  }
}
