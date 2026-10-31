import { describe, expect, it } from 'vitest'
import { API, CSRF_HEADER } from './api-contract'

describe('API paths', () => {
  it('builds the run end path', () => {
    expect(API.runEnd('abc')).toBe('/api/runs/abc/end')
  })

  it('builds the Ripperdoc purchase path', () => {
    expect(API.ripperdocBuy('greed')).toBe('/api/ripperdoc/greed/buy')
  })

  it('uses the agreed CSRF header', () => {
    expect(CSRF_HEADER).toBe('X-CSRF-Token')
  })
})
