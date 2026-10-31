// Damage and healing formulas (spec 2.5 psychosis tiers, armor floor of 1).
import { balance } from '@data/index'
import type { Stats } from '@shared/types'
import type { Rng } from './rng'

const tiers = (psychosis: number) => Math.floor(psychosis / 10)

export function computeDamage(
  base: number,
  stats: Stats,
  opts: { psychosis: number; frenzy: boolean; rng: Rng },
): { amount: number; crit: boolean } {
  const p = balance.psychosis
  let amount = base * stats.might * (1 + tiers(opts.psychosis) * p.damagePer10)
  if (opts.frenzy) amount *= p.frenzyDamageMult
  const crit = opts.rng.next() < stats.crit
  if (crit) amount *= 2
  return { amount, crit }
}

export function damageTaken(raw: number, armor: number): number {
  return Math.max(1, raw - armor)
}

export function healAmount(raw: number, psychosis: number): number {
  return raw * (1 - tiers(psychosis) * balance.psychosis.healPenaltyPer10)
}
