// Domain types shared by game engine, UI and API client.
// Owned by the coordinator: agents read, never edit.

export type CharacterId = 'david' | 'lucy' | 'rebecca' | 'maine' | 'kiwi' | 'pilar' | 'dorio' | 'falco'
export type WeaponId =
  | 'pistol'
  | 'shotgun'
  | 'minigun'
  | 'monowire'
  | 'smart_pistol'
  | 'grenade_launcher'
  | 'mantis_blades'
  | 'drone'
  | 'heavy_rifle'
export type CyberwareId =
  | 'kerenzikov'
  | 'synthetic_muscle'
  | 'subdermal_armor'
  | 'neural_link'
  | 'kiroshi_optics'
  | 'blast_dampener'
  | 'biomonitor'
  | 'data_collector'
export type EnemyId = 'maelstrom' | 'arasaka' | 'maxtac' | 'cyberpsycho'
export type RipperdocUpgradeId =
  | 'max_hp'
  | 'armor'
  | 'regen'
  | 'might'
  | 'speed'
  | 'area'
  | 'cooldown'
  | 'magnet'
  | 'luck'
  | 'growth'
  | 'revival'
  | 'greed'
export type SkillId =
  | 'sandevistan'
  | 'quickhack'
  | 'explosive_barrage'
  | 'suppression'
  | 'snipe'
  | 'cluster_grenade'
  | 'heavy_burst'
  | 'support'
export type AimType = 'aim' | 'nearest' | 'area'
export type WeaponBehavior = 'projectile' | 'cone' | 'orbit' | 'lob' | 'melee_arc' | 'drone' | 'pierce_beam'
export type EnemyBehavior = 'chase' | 'kite' | 'charger' | 'boss'

export type StatKey =
  | 'maxHp'
  | 'regen'
  | 'armor'
  | 'speed'
  | 'might'
  | 'area'
  | 'cooldown'
  | 'duration'
  | 'projectileSpeed'
  | 'magnet'
  | 'luck'
  | 'growth'
  | 'revival'
  | 'greed'
  | 'crit'
export type Stats = Record<StatKey, number>
/** op 'add' adds value; op 'mul' adds value to the percentage (0.10 = +10%). */
export interface StatModifier {
  stat: StatKey
  op: 'add' | 'mul'
  value: number
}

export interface CharacterDef {
  id: CharacterId
  name: string
  starter: boolean
  spriteKey: string | null
  color: string
  startingWeapon: WeaponId
  skill: SkillId
  passive: StatModifier[]
}
export interface SkillDef {
  id: SkillId
  name: string
  description: string
  cooldownSec: number
  durationSec: number
  params: Record<string, number>
}
export interface WeaponLevelStats {
  damage: number
  cooldownSec: number
  projectiles: number
  area: number
  speed: number
  durationSec: number
  pierce: number
}
export interface WeaponDef {
  id: WeaponId
  name: string
  description: string
  aim: AimType
  behavior: WeaponBehavior
  /** length 8, index 0 = level 1 */
  levels: WeaponLevelStats[]
  evolution: { requires: CyberwareId; id: string; name: string; stats: WeaponLevelStats }
}
export interface CyberwareDef {
  id: CyberwareId
  name: string
  description: string
  maxLevel: 5
  perLevel: StatModifier[]
}
export interface EnemyDef {
  id: EnemyId
  name: string
  spriteKey: string | null
  color: string
  behavior: EnemyBehavior
  hp: number
  speed: number
  damage: number
  xp: number
  eurodollarChance: number
  ranged?: { range: number; cooldownSec: number; projectileSpeed: number; damage: number }
}
export interface SpawnWeight {
  enemyId: EnemyId
  weight: number
}
export interface SpecialHorde {
  atSec: number
  type: 'ring' | 'wall' | 'swarm'
  enemyId: EnemyId
  count: number
}
/** toSec === -1 means the phase never ends. */
export interface PhaseDef {
  fromSec: number
  toSec: number
  spawnPerSec: number
  mix: SpawnWeight[]
  specials: SpecialHorde[]
}
export interface WavesDef {
  phases: PhaseDef[]
  eliteEverySec: number
  bossEverySec: number
  maxtacAlertAtSec: number
  enemyCap: number
}

export type UnlockRule =
  | { type: 'survive'; seconds: number }
  | { type: 'kills'; enemyId: EnemyId; count: number }
  | { type: 'eurodollars_total'; amount: number }
  | { type: 'survive_with'; characterId: CharacterId; seconds: number }
  | { type: 'distinct_characters'; count: number; seconds: number }
export interface UnlockDef {
  characterId: CharacterId
  rule: UnlockRule
  description: string
}
export interface RipperdocDef {
  id: RipperdocUpgradeId
  name: string
  maxRank: number
  perRank: StatModifier
  baseCost: number
  costGrowth: number
}

export interface GameOptions {
  autoAim: boolean
  musicVolume: number
  sfxVolume: number
  showFps: boolean
  screenShake: boolean
}
export interface RunConfig {
  mode: 'guest' | 'online'
  runId: string | null
  seed: number
  characterId: CharacterId
  ripperdoc: Partial<Record<RipperdocUpgradeId, number>>
  options: GameOptions
}
export interface OwnedWeapon {
  id: WeaponId
  level: number
  evolved: boolean
}
export interface OwnedCyberware {
  id: CyberwareId
  level: number
}
export interface HudState {
  timeSec: number
  hp: number
  maxHp: number
  level: number
  xp: number
  xpToNext: number
  kills: number
  eurodollars: number
  psychosis: number
  psychosisActive: boolean
  skillCooldown01: number
  weapons: OwnedWeapon[]
  cyberware: OwnedCyberware[]
  bossHp01: number | null
  maxtacAlert: boolean
  fps: number | null
}
export type LevelUpCard =
  | { kind: 'weapon_new'; id: WeaponId }
  | { kind: 'weapon_up'; id: WeaponId; level: number }
  | { kind: 'cyber_new'; id: CyberwareId }
  | { kind: 'cyber_up'; id: CyberwareId; level: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'eurodollars'; amount: number }
export interface ChestReward {
  cards: LevelUpCard[]
  evolution: { weapon: WeaponId; into: string } | null
}
export interface RunCheckpoint {
  elapsedSec: number
  kills: number
  level: number
  eurodollars: number
}
export interface RunResult {
  runId: string | null
  characterId: CharacterId
  durationSec: number
  kills: number
  killsByEnemy: Partial<Record<EnemyId, number>>
  level: number
  eurodollarsCollected: number
  weaponsSeen: WeaponId[]
  enemiesSeen: EnemyId[]
}
export interface GameCanvasProps {
  config: RunConfig
  onEnd: (result: RunResult) => void
}

export const STARTER_CHARACTERS: readonly CharacterId[] = ['david', 'lucy', 'rebecca']
export const MAX_WEAPONS = 6
export const MAX_CYBERWARE = 6
export const MAX_WEAPON_LEVEL = 8
export const DEFAULT_OPTIONS: GameOptions = {
  autoAim: false,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  showFps: false,
  screenShake: true,
}
