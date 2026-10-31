import { describe, expect, it } from 'vitest'
import { applyCard, createInventory } from './inventory'

describe('inventory', () => {
  it('starts with the starting weapon at level 1', () => {
    expect(createInventory('pistol')).toEqual({ weapons: [{ id: 'pistol', level: 1, evolved: false }], cyberware: [] })
  })

  it('applies weapon and cyberware cards immutably', () => {
    const inv = createInventory('pistol')
    const up = applyCard(inv, { kind: 'weapon_up', id: 'pistol', level: 2 })
    expect(up.weapons[0].level).toBe(2)
    expect(inv.weapons[0].level).toBe(1)
    const more = applyCard(applyCard(up, { kind: 'weapon_new', id: 'shotgun' }), { kind: 'cyber_new', id: 'kerenzikov' })
    expect(more.weapons.map((w) => w.id)).toEqual(['pistol', 'shotgun'])
    expect(applyCard(more, { kind: 'cyber_up', id: 'kerenzikov', level: 2 }).cyberware).toEqual([{ id: 'kerenzikov', level: 2 }])
  })

  it('leaves the inventory alone for heal and eurodollars', () => {
    const inv = createInventory('pistol')
    expect(applyCard(inv, { kind: 'heal', amount: 30 })).toBe(inv)
    expect(applyCard(inv, { kind: 'eurodollars', amount: 25 })).toBe(inv)
  })
})
