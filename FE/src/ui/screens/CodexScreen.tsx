import { useNavigate } from 'react-router'
import { enemies, weapons } from '@data'
import { NeonLink } from '../components/NeonButton'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { getLocale } from '../i18n/locale'
import { useGamepadNav } from '../nav/useGamepadNav'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import styles from './Screens.module.css'

function Unknown() {
  return (
    <>
      <span className={styles.unknown}>{t('codex.unknown')}</span>
      <span className={`${styles.muted} visually-hidden`}>{t('codex.unknownHint')}</span>
    </>
  )
}

/** Enemies and weapons met: from the save for registered users, from this page's guest runs otherwise. */
export default function CodexScreen() {
  const navigate = useNavigate()
  const navRef = useGamepadNav({ onBack: () => navigate('/') })
  const status = useSession((s) => s.status)
  const save = useSession((s) => s.save)
  const guestCodex = useRun((s) => s.guestCodex)
  const registered = status === 'authenticated'
  const codex = registered ? (save?.codex ?? { enemies: [], weapons: [] }) : guestCodex
  const kills = registered ? (save?.killStats ?? {}) : {}

  return (
    <div className={styles.screen} ref={navRef}>
      <Panel title={t('codex.title')} wide>
        <p className={styles.muted}>{registered ? t('codex.intro') : t('codex.guest')}</p>

        <h3 id="codex-enemies">{t('codex.enemies')}</h3>
        <ul className={styles.codexGrid} aria-labelledby="codex-enemies">
          {enemies.map((e) => (
            <li key={e.id} className={styles.codexEntry}>
              {codex.enemies.includes(e.id) ? (
                <>
                  <div className={styles.rowTitle}>{e.name}</div>
                  <div className={styles.muted}>
                    {t('codex.enemyStats', { hp: e.hp, speed: e.speed, damage: e.damage })}
                  </div>
                  {kills[e.id] !== undefined && (
                    <div>{t('codex.kills', { count: (kills[e.id] ?? 0).toLocaleString(getLocale()) })}</div>
                  )}
                </>
              ) : (
                <Unknown />
              )}
            </li>
          ))}
        </ul>

        <h3 id="codex-weapons">{t('codex.weapons')}</h3>
        <ul className={styles.codexGrid} aria-labelledby="codex-weapons">
          {weapons.map((w) => (
            <li key={w.id} className={styles.codexEntry}>
              {codex.weapons.includes(w.id) ? (
                <>
                  <div className={styles.rowTitle}>{w.name}</div>
                  <div>{w.description}</div>
                  <div className={styles.muted}>
                    {t('codex.weaponStats', {
                      damage: w.levels[0].damage,
                      cooldown: w.levels[0].cooldownSec.toLocaleString(getLocale()),
                    })}
                  </div>
                  <div className={styles.muted}>{t('codex.evolution', { name: w.evolution.name })}</div>
                </>
              ) : (
                <Unknown />
              )}
            </li>
          ))}
        </ul>

        <NeonLink to="/" autoFocus>
          {t('app.back')}
        </NeonLink>
      </Panel>
    </div>
  )
}
