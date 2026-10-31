// Per-sprite lookup of resolved animation keys, built once so the frame loop does no string work.
import { resolveAnim, type Action, type Dir } from './animations'

export type AnimTable = Record<Dir, Record<Action, string | null>>

const DIRS: readonly Dir[] = ['down', 'side', 'up']
const ACTIONS: readonly Action[] = ['idle', 'walk', 'shoot', 'skill', 'hurt', 'death']
const cache = new WeakMap<Set<string>, Map<string, AnimTable | null>>()

/** Null when the sprite key has no animation at all (placeholder). */
export function animTable(available: Set<string>, spriteKey: string | null): AnimTable | null {
  if (!spriteKey) return null
  let bySet = cache.get(available)
  if (!bySet) {
    bySet = new Map()
    cache.set(available, bySet)
  }
  if (bySet.has(spriteKey)) return bySet.get(spriteKey) ?? null
  let any = false
  const table = {} as AnimTable
  for (const d of DIRS) {
    table[d] = {} as Record<Action, string | null>
    for (const a of ACTIONS) {
      const key = resolveAnim(available, spriteKey, d, a)
      table[d][a] = key
      if (key) any = true
    }
  }
  const result = any ? table : null
  bySet.set(spriteKey, result)
  return result
}

/** Direction from a movement vector; left is `side` flipped. */
export function dirOf(dx: number, dy: number): Dir {
  if (Math.abs(dx) >= Math.abs(dy)) return 'side'
  return dy < 0 ? 'up' : 'down'
}
