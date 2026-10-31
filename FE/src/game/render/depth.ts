// Draw order by layer. Actors are y-sorted relative to a reference (the player), never by raw
// world y: the world is endless, so absolute y would sooner or later cross the other layers.

export const LAYER = { floor: 0, decor: 1, pickup: 2, actor: 3, fx: 4, text: 5 } as const
export type Layer = (typeof LAYER)[keyof typeof LAYER]

const SPAN = 100000
const HALF = SPAN / 2 - 1

export function layerDepth(layer: Layer): number {
  return layer * SPAN
}

/** Actor depth: lower on screen draws on top; clamped so it never leaves the actor layer. */
export function actorDepth(y: number, refY: number): number {
  return LAYER.actor * SPAN + Math.min(HALF, Math.max(-HALF, y - refY))
}
