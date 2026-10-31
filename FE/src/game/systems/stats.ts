// Final stats = (base + sum of add) * (1 + sum of mul), from character, Ripperdoc and run cyberware.
import { getCyberware, getRipperdoc } from '@data/index'
import type {
  CharacterDef,
  OwnedCyberware,
  RipperdocUpgradeId,
  RunConfig,
  StatKey,
  StatModifier,
  Stats,
} from '@shared/types'

export function computeStats(base: Stats, mods: readonly StatModifier[]): Stats {
  const add: Partial<Record<StatKey, number>> = {}
  const mul: Partial<Record<StatKey, number>> = {}
  for (const m of mods) {
    const bucket = m.op === 'add' ? add : mul
    bucket[m.stat] = (bucket[m.stat] ?? 0) + m.value
  }
  const out = { ...base }
  for (const key of Object.keys(base) as StatKey[]) {
    out[key] = (base[key] + (add[key] ?? 0)) * (1 + (mul[key] ?? 0))
  }
  return out
}

export function collectModifiers(
  character: CharacterDef,
  ripperdoc: RunConfig['ripperdoc'],
  cyber: readonly OwnedCyberware[],
): StatModifier[] {
  const mods: StatModifier[] = [...character.passive]
  for (const [id, rank] of Object.entries(ripperdoc) as [RipperdocUpgradeId, number][]) {
    if (!rank) continue
    const per = getRipperdoc(id).perRank
    mods.push({ stat: per.stat, op: per.op, value: per.value * rank })
  }
  for (const owned of cyber) {
    for (const per of getCyberware(owned.id).perLevel) {
      mods.push({ stat: per.stat, op: per.op, value: per.value * owned.level })
    }
  }
  return mods
}
