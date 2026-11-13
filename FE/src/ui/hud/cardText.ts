import { getWeapon } from '@data'
import type { LevelUpCard, WeaponId } from '@shared/types'
import { cyberwareDescription, cyberwareName, evolutionName as evoName, weaponDescription, weaponName } from '../i18n/dataText'
import { t } from '../i18n/it'

export function cardText(card: LevelUpCard): { title: string; subtitle: string } {
  switch (card.kind) {
    case 'weapon_new':
      return { title: weaponName(card.id), subtitle: weaponDescription(card.id) }
    case 'weapon_up':
      return { title: weaponName(card.id), subtitle: t('card.level', { level: card.level }) }
    case 'cyber_new':
      return { title: cyberwareName(card.id), subtitle: cyberwareDescription(card.id) }
    case 'cyber_up':
      return { title: cyberwareName(card.id), subtitle: t('card.level', { level: card.level }) }
    case 'heal':
      return { title: t('card.heal'), subtitle: t('card.healAmount', { amount: card.amount }) }
    case 'eurodollars':
      return { title: t('card.eurodollars'), subtitle: t('card.eurodollarsAmount', { amount: card.amount }) }
  }
}

export function cardBadge(card: LevelUpCard): string | null {
  if (card.kind === 'weapon_new') return t('card.newWeapon')
  if (card.kind === 'cyber_new') return t('card.newCyberware')
  return null
}

/** Evolution name from its id; unknown values (already a name) are shown as they are. */
export function evolutionName(weapon: WeaponId, into: string): string {
  return into === getWeapon(weapon).evolution.id ? evoName(weapon) : into
}
