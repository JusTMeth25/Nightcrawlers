import { describe, expect, it } from 'vitest'
import { actorDepth, LAYER, layerDepth } from './depth'

describe('depth', () => {
  for (const ref of [-200000, 0, 200000]) {
    it(`keeps floor < decor < pickups < actors < fx < text around y = ${ref}`, () => {
      const above = actorDepth(ref - 400, ref)
      const below = actorDepth(ref + 400, ref)
      expect(layerDepth(LAYER.floor)).toBeLessThan(layerDepth(LAYER.decor))
      expect(layerDepth(LAYER.decor)).toBeLessThan(layerDepth(LAYER.pickup))
      expect(layerDepth(LAYER.pickup)).toBeLessThan(above)
      expect(above).toBeLessThan(actorDepth(ref, ref))
      expect(actorDepth(ref, ref)).toBeLessThan(below)
      expect(below).toBeLessThan(layerDepth(LAYER.fx))
      expect(layerDepth(LAYER.fx)).toBeLessThan(layerDepth(LAYER.text))
    })
  }

  it('stays inside the actor layer for very far actors', () => {
    expect(actorDepth(1e9, 0)).toBeLessThan(layerDepth(LAYER.fx))
    expect(actorDepth(-1e9, 0)).toBeGreaterThan(layerDepth(LAYER.pickup))
  })
})
