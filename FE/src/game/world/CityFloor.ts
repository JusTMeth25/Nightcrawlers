// Endless Night City floor: a generated asphalt TileSprite that follows the camera,
// plus decorations placed deterministically per city block (seed + cell coordinates).
import Phaser from 'phaser'
import { createRng } from '../systems/rng'
import { cellHash } from './cityHash'

const TILE = 256
const BLOCK = 384
const DECOR_KINDS = 4
const DECOR_POOL = 48
const FLOOR_KEY = 'floor_tile'
const NEON = [0x05d9e8, 0xff2a6d, 0xd1f7ff, 0xf5e663]

export class CityFloor {
  private readonly scene: Phaser.Scene
  private readonly seed: number
  private readonly tile: Phaser.GameObjects.TileSprite
  private readonly decor: Phaser.GameObjects.Image[] = []
  private lastRange = ''

  constructor(scene: Phaser.Scene, seed: number) {
    this.scene = scene
    this.seed = seed
    this.makeTextures()
    this.tile = scene.add.tileSprite(0, 0, 16, 16, FLOOR_KEY).setOrigin(0, 0).setDepth(-100000)
    for (let i = 0; i < DECOR_POOL; i++) {
      this.decor.push(scene.add.image(0, 0, 'decor_0').setVisible(false).setDepth(-90000))
    }
  }

  private makeTextures(): void {
    const tex = this.scene.textures
    if (tex.exists(FLOOR_KEY)) return
    const rng = createRng(this.seed ^ 0x51ed)
    const g = this.scene.make.graphics({}, false)
    g.fillStyle(0x0c0b14, 1)
    g.fillRect(0, 0, TILE, TILE)
    // asphalt grain
    for (let i = 0; i < 260; i++) {
      g.fillStyle(rng.next() < 0.5 ? 0x14121f : 0x08070d, 0.9)
      g.fillRect(rng.int(0, TILE - 2), rng.int(0, TILE - 2), rng.int(1, 3), rng.int(1, 3))
    }
    // slab seams
    g.lineStyle(1, 0x1b1930, 1)
    for (let p = 0; p <= TILE; p += 64) {
      g.lineBetween(p, 0, p, TILE)
      g.lineBetween(0, p, TILE, p)
    }
    // neon reflections and puddles
    for (let i = 0; i < 3; i++) {
      g.fillStyle(rng.pick(NEON), 0.05)
      g.fillEllipse(rng.int(30, TILE - 30), rng.int(30, TILE - 30), rng.int(30, 70), rng.int(10, 24))
    }
    g.lineStyle(1, 0x05d9e8, 0.18)
    g.lineBetween(0, 128, TILE, 128)
    g.lineStyle(1, 0xff2a6d, 0.12)
    g.lineBetween(128, 0, 128, TILE)
    g.generateTexture(FLOOR_KEY, TILE, TILE)

    for (let k = 0; k < DECOR_KINDS; k++) {
      g.clear()
      const c = NEON[k]
      if (k === 0) {
        // neon sign reflection
        g.fillStyle(c, 0.08)
        g.fillEllipse(48, 20, 96, 40)
        g.fillStyle(c, 0.25)
        g.fillRect(24, 16, 48, 4)
      } else if (k === 1) {
        // crate
        g.fillStyle(0x1d1a2b, 1)
        g.fillRect(8, 4, 40, 32)
        g.lineStyle(2, c, 0.6)
        g.strokeRect(8, 4, 40, 32)
      } else if (k === 2) {
        // barrier with hazard stripes
        g.fillStyle(0x17151f, 1)
        g.fillRect(0, 12, 80, 14)
        g.fillStyle(c, 0.7)
        for (let s = 4; s < 80; s += 16) g.fillRect(s, 14, 6, 10)
      } else {
        // sewer vent glow
        g.fillStyle(c, 0.06)
        g.fillCircle(24, 24, 24)
        g.lineStyle(1, c, 0.35)
        for (let s = 10; s < 40; s += 6) g.lineBetween(10, s, 38, s)
      }
      g.generateTexture(`decor_${k}`, k === 2 ? 80 : 96, 48)
    }
    g.destroy()
  }

  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    const v = cam.worldView
    this.tile.setPosition(v.x, v.y)
    this.tile.setSize(v.width + 2, v.height + 2)
    this.tile.setTilePosition(v.x, v.y)

    const x0 = Math.floor(v.x / BLOCK) - 1
    const x1 = Math.floor((v.x + v.width) / BLOCK) + 1
    const y0 = Math.floor(v.y / BLOCK) - 1
    const y1 = Math.floor((v.y + v.height) / BLOCK) + 1
    const range = `${x0},${x1},${y0},${y1}`
    if (range === this.lastRange) return
    this.lastRange = range
    let used = 0
    for (let cx = x0; cx <= x1 && used < DECOR_POOL; cx++) {
      for (let cy = y0; cy <= y1 && used < DECOR_POOL; cy++) {
        const h = cellHash(this.seed, cx, cy)
        if (h % 3 !== 0) continue
        const img = this.decor[used++]
        img
          .setTexture(`decor_${(h >>> 4) % DECOR_KINDS}`)
          .setPosition(cx * BLOCK + ((h >>> 8) % (BLOCK - 96)) + 48, cy * BLOCK + ((h >>> 16) % (BLOCK - 48)) + 24)
          .setVisible(true)
      }
    }
    for (let i = used; i < DECOR_POOL; i++) this.decor[i].setVisible(false)
  }

  destroy(): void {
    this.tile.destroy()
    for (const d of this.decor) d.destroy()
  }
}
