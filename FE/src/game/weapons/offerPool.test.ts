import { describe, expect, it } from 'vitest'
import { weapons } from '@data/index'
import { implementedWeapons } from './offerPool'

describe('implementedWeapons', () => {
  it('offers every weapon of the data once all behaviours exist', () => {
    expect(implementedWeapons().sort()).toEqual(weapons.map((w) => w.id).sort())
  })
})
