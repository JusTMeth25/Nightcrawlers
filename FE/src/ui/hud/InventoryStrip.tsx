import { getCyberware, getWeapon } from '@data'
import type { OwnedCyberware, OwnedWeapon } from '@shared/types'
import { t } from '../i18n/it'
import styles from './Hud.module.css'

export function InventoryStrip({ weapons, cyberware }: { weapons: OwnedWeapon[]; cyberware: OwnedCyberware[] }) {
  return (
    <div className={styles.inventory}>
      <ul className={styles.slots} aria-label={t('hud.weapons')}>
        {weapons.map((w) => {
          const def = getWeapon(w.id)
          return (
            <li key={w.id} className={[styles.slot, w.evolved && styles.evolved].filter(Boolean).join(' ')}>
              <span>{w.evolved ? def.evolution.name : def.name}</span>
              {!w.evolved && <span className={styles.slotLevel}>{w.level}</span>}
            </li>
          )
        })}
      </ul>
      <ul className={styles.slots} aria-label={t('hud.cyberware')}>
        {cyberware.map((c) => (
          <li key={c.id} className={[styles.slot, styles.cyberSlot].join(' ')}>
            <span>{getCyberware(c.id).name}</span>
            <span className={styles.slotLevel}>{c.level}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
