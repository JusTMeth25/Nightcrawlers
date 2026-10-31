// Uniform hash grid for neighbour queries. Rebuilt every frame; arrays are reused, so no garbage.

const OFFSET = 32768

export class SpatialGrid {
  private readonly cellSize: number
  private readonly cells = new Map<number, number[]>()
  private readonly used: number[][] = []
  private readonly ids: number[] = []
  private readonly xs: number[] = []
  private readonly ys: number[] = []
  private size = 0

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private key(cx: number, cy: number): number {
    return (cx + OFFSET) * 65536 + (cy + OFFSET)
  }

  clear(): void {
    for (const cell of this.used) cell.length = 0
    this.used.length = 0
    this.size = 0
    // the world is endless: forget cells the player left behind
    if (this.cells.size > 4096) this.cells.clear()
  }

  insert(id: number, x: number, y: number): void {
    const i = this.size++
    this.ids[i] = id
    this.xs[i] = x
    this.ys[i] = y
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
    let cell = this.cells.get(k)
    if (!cell) {
      cell = []
      this.cells.set(k, cell)
    }
    if (cell.length === 0) this.used.push(cell)
    cell.push(i)
  }

  /** Writes the ids within r into `out` (from index 0) and returns how many. */
  queryRadius(x: number, y: number, r: number, out: number[]): number {
    let n = 0
    const r2 = r * r
    const cs = this.cellSize
    const x0 = Math.floor((x - r) / cs)
    const x1 = Math.floor((x + r) / cs)
    const y0 = Math.floor((y - r) / cs)
    const y1 = Math.floor((y + r) / cs)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy))
        if (!cell) continue
        for (let j = 0; j < cell.length; j++) {
          const i = cell[j]
          const dx = this.xs[i] - x
          const dy = this.ys[i] - y
          if (dx * dx + dy * dy <= r2) out[n++] = this.ids[i]
        }
      }
    }
    return n
  }

  /** Id of the closest point within maxR, or -1. */
  nearest(x: number, y: number, maxR: number): number {
    let best = -1
    let bestD2 = maxR * maxR
    const cs = this.cellSize
    const x0 = Math.floor((x - maxR) / cs)
    const x1 = Math.floor((x + maxR) / cs)
    const y0 = Math.floor((y - maxR) / cs)
    const y1 = Math.floor((y + maxR) / cs)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy))
        if (!cell) continue
        for (let j = 0; j < cell.length; j++) {
          const i = cell[j]
          const dx = this.xs[i] - x
          const dy = this.ys[i] - y
          const d2 = dx * dx + dy * dy
          if (d2 <= bestD2) {
            bestD2 = d2
            best = this.ids[i]
          }
        }
      }
    }
    return best
  }
}
