// Neon placeholders for characters and enemies without a spritesheet (spec 3.6).
// The texture frame gets a feet pivot like the atlas frames, so entities never call setOrigin.
import type Phaser from 'phaser'

export type PlaceholderShape = 'hero' | 'enemy' | 'boss'

export function placeholderKey(id: string): string {
  return `ph_${id}`
}

const GLOW_STEPS = 4

type Pt = { x: number; y: number }

/** Path helpers: Phaser 4 typings want Vector2[] for fillPoints, a plain path avoids that. */
export function tracePolygon(g: Phaser.GameObjects.Graphics, pts: readonly Pt[]): Phaser.GameObjects.Graphics {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.closePath()
  return g
}

function shapePoints(shape: PlaceholderShape, cx: number, cy: number, r: number): Pt[] {
  const sides = shape === 'hero' ? 4 : shape === 'enemy' ? 3 : 6
  const start = shape === 'enemy' ? Math.PI / 2 : -Math.PI / 2
  const pts: Pt[] = []
  for (let i = 0; i < sides; i++) {
    const a = start + (i / sides) * Math.PI * 2
    // heroes are a tall diamond so they read as a standing figure
    const sx = shape === 'hero' ? 0.6 : 1
    pts.push({ x: cx + Math.cos(a) * r * sx, y: cy + Math.sin(a) * r })
  }
  return pts
}

/** Creates the texture once (shape + glow) and returns its key. */
export function drawPlaceholder(
  scene: Phaser.Scene,
  id: string,
  color: string,
  size: number,
  shape: PlaceholderShape,
): string {
  const key = placeholderKey(id)
  if (scene.textures.exists(key)) return key
  const tint = Number.parseInt(color.replace('#', ''), 16) || 0xffffff
  const pad = Math.ceil(size * 0.35)
  const w = size + pad * 2
  const h = size + pad * 2
  const cx = w / 2
  const cy = h / 2
  const r = size / 2
  const g = scene.make.graphics({}, false)
  for (let i = GLOW_STEPS; i >= 1; i--) {
    g.fillStyle(tint, 0.08)
    tracePolygon(g, shapePoints(shape, cx, cy, r + (pad * i) / GLOW_STEPS)).fillPath()
  }
  g.fillStyle(0x0a0a12, 0.95)
  tracePolygon(g, shapePoints(shape, cx, cy, r)).fillPath()
  g.lineStyle(Math.max(2, size / 12), tint, 1)
  tracePolygon(g, shapePoints(shape, cx, cy, r)).strokePath()
  g.fillStyle(tint, 1)
  g.fillCircle(cx, cy - r * 0.25, Math.max(2, size / 10))
  g.generateTexture(key, w, h)
  g.destroy()
  const frame = scene.textures.getFrame(key)
  if (frame) {
    // feet = bottom of the shape, not of the glow
    frame.customPivot = true
    frame.pivotX = 0.5
    frame.pivotY = (cy + r) / h
  }
  return key
}
