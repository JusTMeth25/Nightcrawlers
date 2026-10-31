// Effective weapon stats, evolutions (spec 2.1, 2.3) and chest rewards (spec 2.8).
import { balance, getWeapon, weapons } from '@data/index'
import {
  MAX_WEAPON_LEVEL,
  type ChestReward,
  type LevelUpCard,
  type OwnedWeapon,
  type Stats,
  type WeaponId,
  type WeaponLevelStats,
} from '@shared/types'
import { applyCard, type Inventory } from './inventory'
import { FALLBACK_CARDS, generateOffers } from './levelup'
import type { Rng } from './rng'

const ALL_WEAPONS: readonly WeaponId[] = weapons.map((w) => w.id)

export function weaponStats(w: OwnedWeapon, stats: Stats): WeaponLevelStats {
  const def = getWeapon(w.id)
  const base = w.evolved ? def.evolution.stats : def.levels[Math.min(w.level, def.levels.length) - 1]
  return {
    ...base,
    area: base.area * stats.area,
    cooldownSec: base.cooldownSec * stats.cooldown,
    durationSec: base.durationSec * stats.duration,
    speed: base.speed * stats.projectileSpeed,
  }
}

export function evolvable(inv: Inventory): WeaponId[] {
  return inv.weapons
    .filter((w) => !w.evolved && w.level >= MAX_WEAPON_LEVEL)
    .filter((w) => inv.cyberware.some((c) => c.id === getWeapon(w.id).evolution.requires))
    .map((w) => w.id)
}

const isFallback = (card: LevelUpCard) => FALLBACK_CARDS.some((f) => f.kind === card.kind)

/**
 * Cards are drawn one at a time against the inventory updated by the previous card,
 * so applying them all never breaks the 6-slot limits.
 */
export function chestReward(
  inv: Inventory,
  rng: Rng,
  luck: number,
  weaponPool: readonly WeaponId[] = ALL_WEAPONS,
): ChestReward {
  const ready = evolvable(inv)
  if (ready.length > 0) {
    return { cards: [], evolution: { weapon: ready[0], into: getWeapon(ready[0]).evolution.id } }
  }
  const [min, max] = balance.drops.chestCards
  const count = rng.int(min, max) + (rng.next() < luck - 1 ? 1 : 0)
  const cards: LevelUpCard[] = []
  let tmp = inv
  for (let i = 0; i < count; i++) {
    const [card] = generateOffers(tmp, rng, 1, 1, weaponPool)
    if (!card || isFallback(card)) {
      // nothing left to upgrade: a single fallback card is better than an empty chest
      if (cards.length === 0 && card) cards.push(card)
      break
    }
    cards.push(card)
    tmp = applyCard(tmp, card)
  }
  return { cards, evolution: null }
}

export function applyEvolution(inv: Inventory, weapon: WeaponId): Inventory {
  return { ...inv, weapons: inv.weapons.map((w) => (w.id === weapon ? { ...w, evolved: true } : w)) }
}
