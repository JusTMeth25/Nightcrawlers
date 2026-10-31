import { describe, expect, it } from 'vitest'
import { getCyberware, getWeapon } from '@data/index'
import { cardBadge, cardText } from './cardText'

describe('cardText', () => {
  it('weapon_up: weapon name and level', () => {
    expect(cardText({ kind: 'weapon_up', id: 'pistol', level: 3 })).toEqual({ title: 'Pistola', subtitle: 'Livello 3' })
  })

  it('weapon_new: weapon name and description', () => {
    expect(cardText({ kind: 'weapon_new', id: 'shotgun' })).toEqual({
      title: 'Shotgun',
      subtitle: getWeapon('shotgun').description,
    })
  })

  it('cyber_new: cyberware name and description', () => {
    expect(cardText({ kind: 'cyber_new', id: 'kerenzikov' })).toEqual({
      title: 'Riflessi Kerenzikov',
      subtitle: getCyberware('kerenzikov').description,
    })
  })

  it('cyber_up: cyberware name and level', () => {
    expect(cardText({ kind: 'cyber_up', id: 'biomonitor', level: 2 })).toEqual({ title: 'Biomonitor', subtitle: 'Livello 2' })
  })

  it('heal and eurodollars fallback cards', () => {
    expect(cardText({ kind: 'heal', amount: 30 })).toEqual({ title: 'Kit medico', subtitle: '+30 PV' })
    expect(cardText({ kind: 'eurodollars', amount: 50 })).toEqual({ title: 'Sacca di €$', subtitle: '+50 €$' })
  })

  it('cardBadge marks new items', () => {
    expect(cardBadge({ kind: 'weapon_new', id: 'pistol' })).toBe('Nuova arma')
    expect(cardBadge({ kind: 'cyber_new', id: 'kerenzikov' })).toBe('Nuovo cyberware')
    expect(cardBadge({ kind: 'weapon_up', id: 'pistol', level: 2 })).toBeNull()
  })
})
