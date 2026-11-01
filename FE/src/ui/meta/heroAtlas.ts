// Frames of the hero atlas (public/assets/atlas/heroes.json), loaded once with fetch for the portraits.
export const HERO_ATLAS_URL = '/assets/atlas/heroes.json'

export interface AtlasRect {
  x: number
  y: number
  w: number
  h: number
}

let pending: Promise<Record<string, AtlasRect>> | null = null

function parse(json: unknown): Record<string, AtlasRect> {
  const frames = (json as { frames?: Record<string, { frame?: Partial<AtlasRect> }> } | null)?.frames
  const out: Record<string, AtlasRect> = {}
  if (!frames || typeof frames !== 'object') return out
  for (const [name, entry] of Object.entries(frames)) {
    const f = entry?.frame
    if (f && [f.x, f.y, f.w, f.h].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[name] = { x: f.x!, y: f.y!, w: f.w!, h: f.h! }
    }
  }
  return out
}

/** Atlas frames by name; on failure resolves empty (portraits fall back to the neon placeholder). */
export function loadHeroFrames(): Promise<Record<string, AtlasRect>> {
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(HERO_ATLAS_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return parse(await res.json())
      } catch {
        pending = null // allow a later retry
        return {}
      }
    })()
  }
  return pending
}

export function portraitFrame(spriteKey: string) {
  return `${spriteKey}_down_idle_0`
}
