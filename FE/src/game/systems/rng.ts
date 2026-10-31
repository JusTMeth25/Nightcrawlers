// Seeded RNG (mulberry32): every random choice in the game goes through it, so a seed replays a run.

export interface Rng {
  /** uniform in [0, 1) */
  next(): number
  int(min: number, maxInclusive: number): number
  pick<T>(arr: readonly T[]): T
  weighted<T>(items: readonly { item: T; weight: number }[]): T
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, maxInclusive) => min + Math.floor(next() * (maxInclusive - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(items) {
      let total = 0
      for (const it of items) total += Math.max(0, it.weight)
      let roll = next() * total
      for (const it of items) {
        const w = Math.max(0, it.weight)
        if (w === 0) continue
        if (roll < w) return it.item
        roll -= w
      }
      // float rounding: fall back to the last item with a positive weight
      for (let i = items.length - 1; i >= 0; i--) if (items[i].weight > 0) return items[i].item
      return items[items.length - 1].item
    },
  }
}
