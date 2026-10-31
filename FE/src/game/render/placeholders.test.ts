import { describe, expect, it, vi } from 'vitest'
import { placeholderKey } from './placeholders'

describe('placeholderKey', () => {
  it('prefixes the id', () => {
    expect(placeholderKey('kiwi')).toBe('ph_kiwi')
  })
})

describe('drawPlaceholder', () => {
  it('creates the texture once with a feet pivot', async () => {
    const { drawPlaceholder } = await import('./placeholders')
    const created = new Set<string>()
    const frame = { customPivot: false, pivotX: 0, pivotY: 0 }
    const gfx = new Proxy({}, { get: (_t, p) => (p === 'generateTexture' ? (k: string) => created.add(k) : () => gfx) })
    const make = { graphics: () => gfx }
    const scene = {
      textures: { exists: (k: string) => created.has(k), getFrame: () => frame },
      make,
    } as unknown as Parameters<typeof drawPlaceholder>[0]
    const spy = vi.spyOn(make, 'graphics')
    expect(drawPlaceholder(scene, 'kiwi', '#ffd447', 32, 'hero')).toBe('ph_kiwi')
    expect(drawPlaceholder(scene, 'kiwi', '#ffd447', 32, 'hero')).toBe('ph_kiwi')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(frame.customPivot).toBe(true)
    expect(frame.pivotX).toBe(0.5)
    expect(frame.pivotY).toBeGreaterThan(0.5)
    expect(frame.pivotY).toBeLessThan(1)
  })

  it('accepts a missing or malformed color', async () => {
    const { drawPlaceholder } = await import('./placeholders')
    const gfx = new Proxy({}, { get: () => () => gfx })
    const scene = {
      textures: { exists: () => false, getFrame: () => null },
      make: { graphics: () => gfx },
    } as unknown as Parameters<typeof drawPlaceholder>[0]
    expect(() => drawPlaceholder(scene, 'x', 'nope', 24, 'boss')).not.toThrow()
  })
})
