import type { OwnedCyberware, OwnedWeapon } from '@shared/types'
import { cyberwareName, evolutionName, weaponName } from '../i18n/dataText'
import { t } from '../i18n/it'
import styles from './Hud.module.css'

export function InventoryStrip({ weapons, cyberware }: { weapons: OwnedWeapon[]; cyberware: OwnedCyberware[] }) {
  return (
    <div className={styles.inventory}>
      <ul className={styles.slots} aria-label={t('hud.weapons')}>
        {weapons.map((w) => (
          <li key={w.id} className={[styles.slot, w.evolved && styles.evolved].filter(Boolean).join(' ')}>
            <span>{w.evolved ? evolutionName(w.id) : weaponName(w.id)}</span>
            {!w.evolved && <span className={styles.slotLevel}>{w.level}</span>}
          </li>
        ))}
      </ul>
      <ul className={styles.slots} aria-label={t('hud.cyberware')}>
        {cyberware.map((c) => (
          <li key={c.id} className={[styles.slot, styles.cyberSlot].join(' ')}>
            <span>{cyberwareName(c.id)}</span>
            <span className={styles.slotLevel}>{c.level}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
