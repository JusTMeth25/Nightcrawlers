import { describe, expect, it } from 'vitest'
import { balance, getCharacter } from '@data/index'
import { collectModifiers, computeStats } from './stats'

describe('computeStats', () => {
  it('applies (base + sum of add) * (1 + sum of mul)', () => {
    const stats = computeStats(balance.baseStats, [
      { stat: 'speed', op: 'add', value: 10 },
      { stat: 'speed', op: 'mul', value: 0.1 },
      { stat: 'speed', op: 'mul', value: -0.05 },
    ])
    expect(stats.speed).toBeCloseTo(136.5)
    expect(stats.maxHp).toBe(balance.baseStats.maxHp)
  })

  it('does not mutate the base stats', () => {
    const base = { ...balance.baseStats }
    computeStats(base, [{ stat: 'might', op: 'mul', value: 1 }])
    expect(base.might).toBe(balance.baseStats.might)
  })
})

describe('collectModifiers', () => {
  it('merges passive, ripperdoc ranks and cyberware levels', () => {
    const mods = collectModifiers(getCharacter('rebecca'), { might: 2 }, [{ id: 'kerenzikov', level: 3 }])
    const might = mods.filter((m) => m.stat === 'might').map((m) => m.value)
    expect(might).toContain(0.2)
    expect(might.some((v) => Math.abs(v - 0.1) < 1e-9)).toBe(true)
    const cd = mods.find((m) => m.stat === 'cooldown')
    expect(cd?.value).toBeCloseTo(-0.24)
  })

  it('ignores ripperdoc rank 0', () => {
    const mods = collectModifiers(getCharacter('david'), { armor: 0 }, [])
    expect(mods.some((m) => m.stat === 'armor')).toBe(false)
  })
})
