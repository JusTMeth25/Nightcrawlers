import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, MAX_WEAPONS, STARTER_CHARACTERS } from './types'

describe('domain constants', () => {
  it('starts with David, Lucy and Rebecca', () => {
    expect(STARTER_CHARACTERS).toEqual(['david', 'lucy', 'rebecca'])
  })

  it('allows six weapons per run', () => {
    expect(MAX_WEAPONS).toBe(6)
  })

  it('keeps manual aim by default', () => {
    expect(DEFAULT_OPTIONS.autoAim).toBe(false)
  })
})
