// Weapons the level-up and chest offers may contain: those whose behaviour exists.
import { weapons } from '@data/index'
import type { WeaponBehavior, WeaponId } from '@shared/types'

export const IMPLEMENTED_BEHAVIORS: ReadonlySet<WeaponBehavior> = new Set<WeaponBehavior>([
  'projectile',
  'cone',
  'orbit',
  'lob',
  'melee_arc',
  'drone',
  'pierce_beam',
])

export function implementedWeapons(): WeaponId[] {
  return weapons.filter((w) => IMPLEMENTED_BEHAVIORS.has(w.behavior)).map((w) => w.id)
}
