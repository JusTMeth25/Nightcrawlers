import { t } from '../i18n/it'
import { Bar } from './Bar'
import { clamp01 } from './format'
import styles from './Hud.module.css'

/**
 * Signature skill status. skillCooldown01 = share of the cooldown still to wait (0 = ready).
 * The skill itself is triggered inside the game (Space, right click, A/RB, touch button).
 */
export function SkillButtonHint({ cooldown01, skillName }: { cooldown01: number; skillName?: string }) {
  const remaining = clamp01(cooldown01)
  const ready = remaining <= 0
  return (
    <div className={styles.skill}>
      <span className={styles.skillName}>{skillName ?? t('hud.skill')}</span>
      {ready ? (
        <span className={styles.skillReady}>{t('hud.skillReady')}</span>
      ) : (
        <Bar label={t('hud.skill')} hideLabel className={styles.skillTrack} value01={1 - remaining} />
      )}
      <span className={styles.skillHint}>{t('hud.skillHint')}</span>
    </div>
  )
}
