// Typed access to the game data. Owned by the coordinator: agents read, never edit.
import type {
  CharacterDef,
  CharacterId,
  CyberwareDef,
  CyberwareId,
  EnemyDef,
  EnemyId,
  RipperdocDef,
  RipperdocUpgradeId,
  SkillDef,
  SkillId,
  Stats,
  UnlockDef,
  WavesDef,
  WeaponDef,
  WeaponId,
} from '@shared/types'
import balanceJson from './balance.json'
import charactersJson from './characters.json'
import cyberwareJson from './cyberware.json'
import enemiesJson from './enemies.json'
import ripperdocJson from './ripperdoc.json'
import skillsJson from './skills.json'
import unlocksJson from './unlocks.json'
import wavesJson from './waves.json'
import weaponsJson from './weapons.json'

export interface Balance {
  baseStats: Stats
  /** xpToNext(l) = round(firstLevel * growth^(l-1) + flatPerLevel * (l-1)) */
  xp: { firstLevel: number; growth: number; flatPerLevel: number }
  psychosis: {
    perKillPerCyberLevel: number
    damagePer10: number
    healPenaltyPer10: number
    frenzyDurationSec: number
    frenzyDamageMult: number
  }
  difficulty: { alertHpPerMin: number; alertDamagePerMin: number; alertSpawnPerMin: number }
  elite: { scale: number; hpMult: number }
  boss: { hpGrowth: number; maxPatterns: number }
  drops: {
    medkitChance: number
    medkitHeal: number
    magnetChance: number
    empChance: number
    eurodollarBag: [number, number]
    chestCards: [number, number]
  }
  reward: { perSecond: number; perKill: number; maxPerMinute: number }
  antiCheat: {
    clockSkewSec: number
    maxKillsPerSec: number
    maxLevelPerMinute: number
    maxEurodollarsPerMinute: number
    checkpointEverySec: number
  }
  player: { invulnerabilitySec: number; pickupRadius: number }
}

export const characters = charactersJson as CharacterDef[]
// params keys differ per skill, so the inferred JSON type needs an unknown hop
export const skills = skillsJson as unknown as SkillDef[]
export const weapons = weaponsJson as WeaponDef[]
export const cyberware = cyberwareJson as CyberwareDef[]
export const enemies = enemiesJson as EnemyDef[]
export const waves = wavesJson as WavesDef
export const balance = balanceJson as Balance
export const unlocks = unlocksJson as UnlockDef[]
export const ripperdoc = ripperdocJson as RipperdocDef[]

function finder<T extends { id: string }>(list: T[], kind: string) {
  const byId = new Map(list.map((item) => [item.id, item]))
  return (id: T['id']): T => {
    const found = byId.get(id)
    if (!found) throw new Error(`Unknown ${kind}: ${id}`)
    return found
  }
}

export const getCharacter: (id: CharacterId) => CharacterDef = finder(characters, 'character')
export const getSkill: (id: SkillId) => SkillDef = finder(skills, 'skill')
export const getWeapon: (id: WeaponId) => WeaponDef = finder(weapons, 'weapon')
export const getCyberware: (id: CyberwareId) => CyberwareDef = finder(cyberware, 'cyberware')
export const getEnemy: (id: EnemyId) => EnemyDef = finder(enemies, 'enemy')
export const getRipperdoc: (id: RipperdocUpgradeId) => RipperdocDef = finder(ripperdoc, 'ripperdoc upgrade')

/** Cost of buying the next rank when the current rank is `currentRank`. */
export function ripperdocCost(def: RipperdocDef, currentRank: number): number {
  return Math.round(def.baseCost * def.costGrowth ** currentRank)
}
