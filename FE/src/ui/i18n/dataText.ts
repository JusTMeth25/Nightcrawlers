import {
  dataText,
  getCyberware,
  getEnemy,
  getRipperdoc,
  getSkill,
  getWeapon,
  unlocks,
  type DataTexts,
} from '@data'
import enTexts from '@data/i18n/en.json'
import esTexts from '@data/i18n/es.json'
import type {
  CharacterId,
  CyberwareId,
  EnemyId,
  Locale,
  RipperdocUpgradeId,
  SkillId,
  UnlockRule,
  WeaponId,
} from '@shared/types'
import { getLocale } from './locale'
import { formatNumber } from './number'

// Game data texts in the current locale. The data JSON is Italian (source and fallback);
// en/es come from FE/src/data/i18n (completeness checked by data/i18n.test.ts).
const texts: Record<Locale, DataTexts | null> = { it: null, en: enTexts, es: esTexts }

/** Translation of a data text key (weapon.pistol.name, …) in the current locale, or the Italian `fallback`. */
export function dt(key: string, fallback: string): string {
  return dataText(texts[getLocale()], key, fallback)
}

export const weaponName = (id: WeaponId) => dt(`weapon.${id}.name`, getWeapon(id).name)
export const weaponDescription = (id: WeaponId) => dt(`weapon.${id}.description`, getWeapon(id).description)
export const evolutionName = (id: WeaponId) => dt(`weapon.${id}.evolution`, getWeapon(id).evolution.name)
export const skillName = (id: SkillId) => dt(`skill.${id}.name`, getSkill(id).name)
export const skillDescription = (id: SkillId) => dt(`skill.${id}.description`, getSkill(id).description)
export const cyberwareName = (id: CyberwareId) => dt(`cyberware.${id}.name`, getCyberware(id).name)
export const cyberwareDescription = (id: CyberwareId) => dt(`cyberware.${id}.description`, getCyberware(id).description)
export const ripperdocName = (id: RipperdocUpgradeId) => dt(`ripperdoc.${id}.name`, getRipperdoc(id).name)
export const enemyName = (id: EnemyId) => dt(`enemy.${id}.name`, getEnemy(id).name)

function ruleValues(rule: UnlockRule): Record<string, string> {
  switch (rule.type) {
    case 'survive':
    case 'survive_with':
      return { minutes: formatNumber(rule.seconds / 60) }
    case 'kills':
      return { count: formatNumber(rule.count) }
    case 'eurodollars_total':
      return { amount: formatNumber(rule.amount) }
    case 'distinct_characters':
      return { minutes: formatNumber(rule.seconds / 60), count: formatNumber(rule.count) }
  }
}

/**
 * Text of the unlock requirement of a character ('' when it has none). The en/es texts take
 * {minutes}/{count}/{amount} from the rule; the Italian fallback is the data text as written.
 */
export function unlockText(characterId: CharacterId): string {
  const unlock = unlocks.find((u) => u.characterId === characterId)
  if (!unlock) return ''
  const values = ruleValues(unlock.rule)
  return dt(`unlock.${characterId}`, unlock.description).replace(/\{(\w+)\}/g, (m, name: string) => values[name] ?? m)
}
