// Animation registry built from atlas frame names: <spriteKey>_<dir>_<action>_<n> and <spriteKey>_fx_<n>.
// Pure helpers (no Phaser import) so the fallback rules are tested in jsdom.

export type Dir = 'down' | 'side' | 'up'
export type Action = 'idle' | 'walk' | 'shoot' | 'skill' | 'hurt' | 'death'

/** Fallback order after the requested direction. Left is `side` with flipX. */
const FALLBACK_DIRS: readonly Dir[] = ['side', 'down', 'up']

const RATES: Record<string, { frameRate: number; repeat: number }> = {
  idle: { frameRate: 6, repeat: -1 },
  walk: { frameRate: 10, repeat: -1 },
  shoot: { frameRate: 12, repeat: -1 },
  skill: { frameRate: 12, repeat: -1 },
  hurt: { frameRate: 10, repeat: 0 },
  death: { frameRate: 8, repeat: 0 },
  fx: { frameRate: 12, repeat: 0 },
}

export function animConfig(action: string): { frameRate: number; repeat: number } {
  return { ...(RATES[action] ?? RATES.idle) }
}

/** Groups frame names by animation key, ordering frames by their numeric suffix. */
export function groupFrames(frameNames: string[]): Map<string, string[]> {
  const groups = new Map<string, { n: number; name: string }[]>()
  for (const name of frameNames) {
    const m = /^(.+)_(\d+)$/.exec(name)
    if (!m) continue
    const list = groups.get(m[1]) ?? []
    list.push({ n: Number(m[2]), name })
    groups.set(m[1], list)
  }
  const out = new Map<string, string[]>()
  for (const [key, list] of groups) out.set(key, list.sort((a, b) => a.n - b.n).map((f) => f.name))
  return out
}

export function animKey(spriteKey: string, dir: Dir, action: string): string {
  return `${spriteKey}_${dir}_${action}`
}

function findAction(available: Set<string>, spriteKey: string, dir: Dir, action: string): string | null {
  const wanted = animKey(spriteKey, dir, action)
  if (available.has(wanted)) return wanted
  for (const d of FALLBACK_DIRS) {
    const key = animKey(spriteKey, d, action)
    if (available.has(key)) return key
  }
  return null
}

/**
 * Same action in the requested direction, then side, down, up; idle (with the same chain)
 * only when the action exists in no direction. Null when the sprite key has nothing.
 */
export function resolveAnim(available: Set<string>, spriteKey: string, dir: Dir, action: string): string | null {
  return findAction(available, spriteKey, dir, action) ?? findAction(available, spriteKey, dir, 'idle')
}

/** Last segment of an animation key, e.g. 'walk' for 'david_side_walk'. */
export function actionOf(key: string): string {
  return key.slice(key.lastIndexOf('_') + 1)
}
