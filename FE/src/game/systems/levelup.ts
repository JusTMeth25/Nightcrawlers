// Level-up offers (spec 2.1) and the queue that hands out several level-ups one at a time.
import { cyberware, weapons } from '@data/index'
import { MAX_CYBERWARE, MAX_WEAPON_LEVEL, MAX_WEAPONS, type LevelUpCard, type WeaponId } from '@shared/types'
import type { Inventory } from './inventory'
import type { Rng } from './rng'

const UPGRADE_WEIGHT = 3
const NEW_WEIGHT = 2
export const FALLBACK_CARDS: readonly LevelUpCard[] = [
  { kind: 'heal', amount: 30 },
  { kind: 'eurodollars', amount: 25 },
]
const ALL_WEAPONS: readonly WeaponId[] = weapons.map((w) => w.id)

/**
 * `weaponPool` limits which weapons can be offered, new or upgraded (the scene passes the
 * weapons whose behavior is implemented).
 */
export function generateOffers(
  inv: Inventory,
  rng: Rng,
  luck: number,
  count = 3,
  weaponPool: readonly WeaponId[] = ALL_WEAPONS,
): LevelUpCard[] {
  const pool: { item: LevelUpCard; weight: number }[] = []
  for (const w of inv.weapons) {
    if (!w.evolved && w.level < MAX_WEAPON_LEVEL && weaponPool.includes(w.id)) {
      pool.push({ item: { kind: 'weapon_up', id: w.id, level: w.level + 1 }, weight: UPGRADE_WEIGHT })
    }
  }
  if (inv.weapons.length < MAX_WEAPONS) {
    for (const id of weaponPool) {
      if (!inv.weapons.some((w) => w.id === id)) pool.push({ item: { kind: 'weapon_new', id }, weight: NEW_WEIGHT })
    }
  }
  for (const c of inv.cyberware) {
    const max = cyberware.find((d) => d.id === c.id)?.maxLevel ?? 5
    if (c.level < max) pool.push({ item: { kind: 'cyber_up', id: c.id, level: c.level + 1 }, weight: UPGRADE_WEIGHT })
  }
  if (inv.cyberware.length < MAX_CYBERWARE) {
    for (const d of cyberware) {
      if (!inv.cyberware.some((c) => c.id === d.id)) pool.push({ item: { kind: 'cyber_new', id: d.id }, weight: NEW_WEIGHT })
    }
  }
  // always roll the luck draw so the RNG stream does not depend on the pool size
  const n = rng.next() < luck - 1 ? count + 1 : count
  if (pool.length === 0) return FALLBACK_CARDS.map((c) => ({ ...c }))
  const out: LevelUpCard[] = []
  while (out.length < n && pool.length > 0) {
    const card = rng.weighted(pool)
    out.push(card)
    pool.splice(
      pool.findIndex((p) => p.item === card),
      1,
    )
  }
  return out
}

export class LevelUpQueue {
  private count = 0

  push(levels: number): void {
    if (levels > 0) this.count += levels
  }

  get pending(): number {
    return this.count
  }

  /** Takes one queued level-up; false when the queue is empty. */
  next(): boolean {
    if (this.count === 0) return false
    this.count--
    return true
  }
}
