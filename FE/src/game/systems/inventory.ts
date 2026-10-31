// Run inventory: owned weapons and cyberware. Immutable updates so the HUD can diff snapshots.
import type { LevelUpCard, OwnedCyberware, OwnedWeapon, WeaponId } from '@shared/types'

export interface Inventory {
  weapons: OwnedWeapon[]
  cyberware: OwnedCyberware[]
}

export function createInventory(startingWeapon: WeaponId): Inventory {
  return { weapons: [{ id: startingWeapon, level: 1, evolved: false }], cyberware: [] }
}

export function applyCard(inv: Inventory, card: LevelUpCard): Inventory {
  switch (card.kind) {
    case 'weapon_new':
      return { ...inv, weapons: [...inv.weapons, { id: card.id, level: 1, evolved: false }] }
    case 'weapon_up':
      return { ...inv, weapons: inv.weapons.map((w) => (w.id === card.id ? { ...w, level: card.level } : w)) }
    case 'cyber_new':
      return { ...inv, cyberware: [...inv.cyberware, { id: card.id, level: 1 }] }
    case 'cyber_up':
      return { ...inv, cyberware: inv.cyberware.map((c) => (c.id === card.id ? { ...c, level: card.level } : c)) }
    default:
      // heal and eurodollars are applied by the scene, not to the inventory
      return inv
  }
}
