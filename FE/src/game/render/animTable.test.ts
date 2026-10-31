import { describe, expect, it } from 'vitest'
import { animTable, dirOf } from './animTable'

const available = new Set(['maine_down_walk', 'maine_down_idle', 'maine_up_idle'])

describe('animTable', () => {
  it('resolves every direction and action once', () => {
    const t = animTable(available, 'maine')
    expect(t?.side.walk).toBe('maine_down_walk')
    expect(t?.up.walk).toBe('maine_down_walk')
    expect(t?.up.death).toBe('maine_up_idle')
    expect(animTable(available, 'maine')).toBe(t)
  })

  it('is null for sprite-less characters', () => {
    expect(animTable(available, null)).toBeNull()
    expect(animTable(available, 'kiwi')).toBeNull()
  })
})

describe('dirOf', () => {
  it('maps vectors to down, side and up', () => {
    expect(dirOf(1, 0)).toBe('side')
    expect(dirOf(-1, 0.2)).toBe('side')
    expect(dirOf(0, -1)).toBe('up')
    expect(dirOf(0.1, 1)).toBe('down')
  })
})
