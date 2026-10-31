import { getCyberware, getWeapon } from '@data/index'
import type { LevelUpCard, WeaponId } from '@shared/types'
import { t } from '../i18n/it'

export function cardText(card: LevelUpCard): { title: string; subtitle: string } {
  switch (card.kind) {
    case 'weapon_new': {
      const w = getWeapon(card.id)
      return { title: w.name, subtitle: w.description }
    }
    case 'weapon_up':
      return { title: getWeapon(card.id).name, subtitle: t('card.level', { level: card.level }) }
    case 'cyber_new': {
      const c = getCyberware(card.id)
      return { title: c.name, subtitle: c.description }
    }
    case 'cyber_up':
      return { title: getCyberware(card.id).name, subtitle: t('card.level', { level: card.level }) }
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
  const evo = getWeapon(weapon).evolution
  return into === evo.id ? evo.name : into
}
