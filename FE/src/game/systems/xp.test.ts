import { describe, expect, it } from 'vitest'
import { addXp, xpToNext } from './xp'

describe('xpToNext', () => {
  it('follows round(first * growth^(l-1) + flat * (l-1))', () => {
    expect(xpToNext(1)).toBe(5)
    expect(xpToNext(2)).toBe(9)
    expect(xpToNext(3)).toBe(13)
  })
})

describe('addXp', () => {
  it('gains several levels at once and keeps the remainder', () => {
    expect(addXp({ level: 1, xp: 0 }, 20, 1)).toEqual({ level: 3, xp: 6, levelsGained: 2 })
  })

  it('multiplies the amount by growth', () => {
    expect(addXp({ level: 1, xp: 0 }, 4, 1.25)).toEqual({ level: 2, xp: 0, levelsGained: 1 })
  })

  it('stays on the level below the threshold', () => {
    expect(addXp({ level: 1, xp: 2 }, 2, 1)).toEqual({ level: 1, xp: 4, levelsGained: 0 })
  })
})
