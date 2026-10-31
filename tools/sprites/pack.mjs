// Atlas packing helpers.

/**
 * Shelf packing: rects sorted by height go left to right, a new shelf starts when the row is full.
 * @param {{ w: number, h: number }[]} sizes
 * @returns {{ positions: { x: number, y: number }[], width: number, height: number }}
 */
export function shelfPack(sizes, { maxWidth = 2048, padding = 2 } = {}) {
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b].h - sizes[a].h)
  const positions = new Array(sizes.length)
  let x = padding, y = padding, shelf = 0, width = 0
  for (const i of order) {
    const { w, h } = sizes[i]
    if (x + w + padding > maxWidth && x > padding) {
      y += shelf + padding
      x = padding
      shelf = 0
    }
    positions[i] = { x, y }
    x += w + padding
    shelf = Math.max(shelf, h)
    width = Math.max(width, x)
  }
  return { positions, width, height: y + shelf + padding }
}

/**
 * Pivot at the character's feet: x = center of solid pixels in the lowest quarter of the solid
 * area (ignores muzzle flashes higher up), y = 1 (bottom edge). Normalized 0..1.
 */
export function feetPivot(rgba, w, h, maskAlpha = 180) {
  const solid = (x, y) => rgba[(y * w + x) * 4 + 3] >= maskAlpha
  let top = -1, bottom = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) {
        if (top === -1) top = y
        bottom = y
        break
      }
    }
  }
  if (top === -1) return { x: 0.5, y: 1 }
  const from = bottom - Math.max(1, Math.round((bottom - top + 1) / 4)) + 1
  let sum = 0, n = 0
  for (let y = from; y <= bottom; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) {
        sum += x
        n++
      }
    }
  }
  return { x: Math.round((sum / n / w) * 1000) / 1000, y: 1 }
}
