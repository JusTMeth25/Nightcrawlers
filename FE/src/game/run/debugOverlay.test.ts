import { describe, expect, it } from 'vitest'
import { debugOverlayEnabled } from './debugOverlay'

describe('debugOverlayEnabled', () => {
  it('never shows the developer line to players, even with FPS on', () => {
    expect(debugOverlayEnabled({ dev: false, stress: false })).toBe(false)
  })

  it('shows it in development builds and in the stress harness', () => {
    expect(debugOverlayEnabled({ dev: true, stress: false })).toBe(true)
    expect(debugOverlayEnabled({ dev: false, stress: true })).toBe(true)
  })
})
