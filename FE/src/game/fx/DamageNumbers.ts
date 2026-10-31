// Floating damage numbers from a fixed pool (oldest reused when all are busy).
// BitmapText on a generated digit font: a hit costs a few glyph quads, never a texture upload.
import Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'
import { CELL_H, CELL_W, FONT_CHARS, FONT_KEY, GLYPH_H, GLYPH_SCALE, GLYPH_W, glyphRows } from './digitFont'

const POOL = 48
const LIFE_SEC = 0.6
const RISE = 28
const FONT_SIZE = 10
const CRIT_TINT = 0xffd447

/** Builds the digit texture and registers it as a bitmap font, once per game. */
export function registerDigitFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return
  const g = scene.make.graphics({}, false)
  for (let c = 0; c < FONT_CHARS.length; c++) {
    const rows = glyphRows(FONT_CHARS[c])
    const ox = c * CELL_W + 1
    // dark outline first, white glyph on top (tinted at runtime)
    for (const [color, grow] of [
      [0x000000, 1],
      [0xffffff, 0],
    ] as const) {
      g.fillStyle(color, 1)
      for (let y = 0; y < GLYPH_H; y++) {
        for (let x = 0; x < GLYPH_W; x++) {
          if (rows[y][x] !== '#') continue
          const s = GLYPH_SCALE
          g.fillRect(ox + x * s - grow, 1 + y * s - grow, s + grow * 2, s + grow * 2)
        }
      }
    }
  }
  g.generateTexture(FONT_KEY, CELL_W * FONT_CHARS.length, CELL_H)
  g.destroy()
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY,
    'offset.x': 0,
    'offset.y': 0,
    width: CELL_W,
    height: CELL_H,
    chars: FONT_CHARS,
    charsPerRow: FONT_CHARS.length,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  })
  // Phaser 4.2.1 typings say BitmapFontData, but Parse returns the whole cache entry
  // ({ data, frame, texture }), ready for the bitmap font cache
  scene.cache.bitmapFont.add(FONT_KEY, entry)
}

export class DamageNumbers {
  private readonly texts: Phaser.GameObjects.BitmapText[] = []
  private readonly life = new Float32Array(POOL)
  private readonly crit = new Uint8Array(POOL)
  private cursor = 0

  constructor(scene: Phaser.Scene) {
    registerDigitFont(scene)
    for (let i = 0; i < POOL; i++) {
      this.texts.push(
        scene.add
          .bitmapText(0, 0, FONT_KEY, '', FONT_SIZE)
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
    const t = this.texts[i].setText(String(Math.round(amount)))
    // tint and scale only when they change
    if (this.crit[i] !== (crit ? 1 : 0)) {
      this.crit[i] = crit ? 1 : 0
      if (crit) t.setTint(CRIT_TINT).setScale(1.4)
      else t.clearTint().setScale(1)
    }
    t.setPosition(x, y).setAlpha(1).setVisible(true)
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
