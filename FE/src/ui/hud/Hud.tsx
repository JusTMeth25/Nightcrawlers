import { useEffect, useState } from 'react'
import { getCharacter, getSkill } from '@data/index'
import { gameBus } from '@shared/events'
import type { CharacterId, HudState } from '@shared/types'
import { t } from '../i18n/it'
import { BossBar } from './BossBar'
import { HpBar } from './HpBar'
import styles from './Hud.module.css'
import { InventoryStrip } from './InventoryStrip'
import { PsychosisBar } from './PsychosisBar'
import { SkillButtonHint } from './SkillButtonHint'
import { Timer } from './Timer'
import { XpBar } from './XpBar'

/** React overlay over the canvas; it follows 'hud:update' (max 10 Hz). */
export function Hud({ characterId }: { characterId?: CharacterId }) {
  const [hud, setHud] = useState<HudState | null>(null)

  useEffect(() => gameBus.on('hud:update', setHud), [])

  const skillName = characterId ? getSkill(getCharacter(characterId).skill).name : undefined

  return (
    <div className={styles.hud}>
      {hud && (
        <>
          <div className={styles.topLeft}>
            <HpBar hp={hud.hp} maxHp={hud.maxHp} />
            <XpBar xp={hud.xp} xpToNext={hud.xpToNext} level={hud.level} />
            <PsychosisBar psychosis={hud.psychosis} active={hud.psychosisActive} />
          </div>
          <div className={styles.topCenter}>
            <Timer timeSec={hud.timeSec} />
            <div className={styles.counters}>
              <span>
                <span className={styles.counterLabel}>{t('hud.kills')}</span>
                <span>{hud.kills}</span>
              </span>
              <span>
                <span className={styles.counterLabel}>{t('hud.eurodollars')}</span>
                <span>{hud.eurodollars}</span>
              </span>
            </div>
            {hud.maxtacAlert && (
              <span className={styles.alert} role="status">
                {t('hud.maxtac')}
              </span>
            )}
            {hud.bossHp01 !== null && <BossBar hp01={hud.bossHp01} />}
          </div>
          <div className={styles.bottomLeft}>
            <InventoryStrip weapons={hud.weapons} cyberware={hud.cyberware} />
          </div>
          <div className={styles.bottomRight}>
            <SkillButtonHint cooldown01={hud.skillCooldown01} skillName={skillName} />
          </div>
        </>
      )}
      <div className={styles.topRight}>
        {hud?.fps != null && <span className={styles.fps}>{t('hud.fps', { fps: Math.round(hud.fps) })}</span>}
        <button
          type="button"
          className={styles.pause}
          aria-label={t('hud.pause')}
          onClick={() => gameBus.emit('pause', undefined)}
        >
          II
        </button>
      </div>
    </div>
  )
}
