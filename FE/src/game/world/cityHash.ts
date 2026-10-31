// Deterministic hash of (seed, cell): the same city block always gets the same decoration.

export function cellHash(seed: number, cx: number, cy: number): number {
  let h = (seed ^ Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
