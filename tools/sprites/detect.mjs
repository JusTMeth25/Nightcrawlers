// Finds sprite frames on a sheet: connected components on alpha, merged when close.

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

function components(rgba, w, h) {
  const label = new Int32Array(w * h).fill(-1)
  const boxes = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || rgba[start * 4 + 3] === 0) continue
    const id = boxes.length
    const box = { x0: w, y0: h, x1: -1, y1: -1, n: 0 }
    label[start] = id
    stack.push(start)
    while (stack.length > 0) {
      const p = stack.pop()
      const x = p % w, y = (p - x) / w
      box.n++
      if (x < box.x0) box.x0 = x
      if (y < box.y0) box.y0 = y
      if (x > box.x1) box.x1 = x
      if (y > box.y1) box.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (label[q] === -1 && rgba[q * 4 + 3] !== 0) {
            label[q] = id
            stack.push(q)
          }
        }
      }
    }
    boxes.push(box)
  }
  return boxes
}

const gapBetween = (a, b) => {
  const gx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) - 1)
  const gy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1)
  return Math.max(gx, gy)
}

function mergeClose(boxes, mergeGap) {
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < boxes.length && !merged; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (gapBetween(boxes[i], boxes[j]) <= mergeGap) {
          const a = boxes[i], b = boxes[j]
          boxes[i] = {
            x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
            x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n,
          }
          boxes.splice(j, 1)
          merged = true
          break
        }
      }
    }
  }
  return boxes
}

/** Groups rects into rows by vertical center, rows top to bottom, each row left to right. */
export function orderRows(rects) {
  if (rects.length === 0) return []
  const heights = rects.map((r) => r.h).sort((a, b) => a - b)
  const tolerance = heights[Math.floor(heights.length / 2)] * 0.5
  const byCenter = [...rects].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))
  const rows = []
  for (const r of byCenter) {
    const cy = r.y + r.h / 2
    const row = rows.find((g) => Math.abs(g.cy - cy) <= tolerance)
    if (row) {
      row.items.push(r)
      row.cy = row.items.reduce((s, it) => s + it.y + it.h / 2, 0) / row.items.length
    } else rows.push({ cy, items: [r] })
  }
  return rows.sort((a, b) => a.cy - b.cy).map((g) => g.items.sort((a, b) => a.x - b.x))
}

/** @returns {Rect[]} frames ordered by row, then by x */
export function detectFrames(rgba, w, h, { minArea = 200, mergeGap = 3 } = {}) {
  const rects = mergeClose(components(rgba, w, h), mergeGap)
    .filter((b) => b.n >= minArea)
    .map((b) => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 }))
  return orderRows(rects).flat()
}

/**
 * Splits the sheet into row bands (`rows`: a count of even bands, or explicit [y0, y1) pairs), then splits each band
 * into frames by column projection of the mask (alpha >= maskAlpha). Faint halos do not bridge frames.
 * cuts[i] lists x columns where band i must split (a frame starts at each cut).
 * Each box then grows over the soft edge (alpha >= edgeAlpha) touching it, inside the band and
 * at most halfway to the neighbouring frames, so outlines and glows are not clipped.
 * @returns {Rect[][]} one array of frames per row, left to right
 */
export function detectInRows(rgba, w, h, { rows, cuts = [], maskAlpha = 128, edgeAlpha = 25, minArea = 200, mergeGap = 3 }) {
  const solid = (x, y) => rgba[(y * w + x) * 4 + 3] >= maskAlpha
  const result = []
  const bands = Array.isArray(rows)
    ? rows
    : Array.from({ length: rows }, (_, r) => [Math.round((r * h) / rows), Math.round(((r + 1) * h) / rows)])
  bands.forEach(([y0, y1], bandIndex) => {
    const forced = [...(cuts[bandIndex] ?? [])].sort((a, b) => a - b)
    const cutBetween = (from, to) => forced.some((c) => c > from && c <= to)
    const cols = new Int32Array(w)
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) if (solid(x, y)) cols[x]++
    const segments = []
    let start = -1, lastFilled = -1
    for (let x = 0; x <= w; x++) {
      const filled = x < w && cols[x] > 0
      if (filled) {
        if (start === -1) start = x
        else if (x - lastFilled - 1 > mergeGap || cutBetween(lastFilled, x)) {
          segments.push([start, lastFilled])
          start = x
        }
        lastFilled = x
      }
    }
    if (start !== -1) segments.push([start, lastFilled])
    const frames = []
    for (const [x0, x1] of segments) {
      let area = 0, top = y1, bottom = -1
      for (let x = x0; x <= x1; x++) area += cols[x]
      if (area < minArea) continue
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (solid(x, y)) {
            if (y < top) top = y
            bottom = y
            break
          }
        }
      }
      frames.push({ x: x0, y: top, w: x1 - x0 + 1, h: bottom - top + 1 })
    }
    result.push(frames.map((f, i) => growOverEdge(rgba, w, f, {
      minX: i > 0 ? Math.floor((frames[i - 1].x + frames[i - 1].w - 1 + f.x) / 2) + 1 : 0,
      maxX: i < frames.length - 1 ? Math.floor((f.x + f.w - 1 + frames[i + 1].x) / 2) : w - 1,
      minY: y0,
      maxY: y1 - 1,
      edgeAlpha,
    })))
  })
  return result
}

function growOverEdge(rgba, w, f, { minX, maxX, minY, maxY, edgeAlpha }) {
  let x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1
  const soft = (x, y) => rgba[(y * w + x) * 4 + 3] >= edgeAlpha
  const colHas = (x) => { for (let y = y0; y <= y1; y++) if (soft(x, y)) return true; return false }
  const rowHas = (y) => { for (let x = x0; x <= x1; x++) if (soft(x, y)) return true; return false }
  for (let grown = true; grown; ) {
    grown = false
    if (x0 > minX && colHas(x0 - 1)) { x0--; grown = true }
    if (x1 < maxX && colHas(x1 + 1)) { x1++; grown = true }
    if (y0 > minY && rowHas(y0 - 1)) { y0--; grown = true }
    if (y1 < maxY && rowHas(y1 + 1)) { y1++; grown = true }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/**
 * Row bands of a regular grid sheet: occupied runs of rows (alpha >= `alpha`) found from the empty
 * horizontal gaps, split halfway between consecutive runs. @returns {[number, number][]}
 */
export function rowBands(rgba, w, h, { alpha = 25 } = {}) {
  const runs = []
  let start = -1
  for (let y = 0; y <= h; y++) {
    let filled = false
    if (y < h) for (let x = 0; x < w && !filled; x++) filled = rgba[(y * w + x) * 4 + 3] >= alpha
    if (filled && start < 0) start = y
    if (!filled && start >= 0) {
      runs.push([start, y - 1])
      start = -1
    }
  }
  return runs.map((r, i) => [
    i === 0 ? 0 : Math.floor((runs[i - 1][1] + r[0]) / 2) + 1,
    i === runs.length - 1 ? h : Math.floor((r[1] + runs[i + 1][0]) / 2) + 1,
  ])
}
