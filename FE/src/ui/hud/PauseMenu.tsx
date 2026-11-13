import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { gameBus } from '@shared/events'
import { NeonButton } from '../components/NeonButton'
import { OptionsPanel } from '../components/OptionsPanel'
import { Panel } from '../components/Panel'
import { t } from '../i18n/it'
import { useGamepadNav } from '../nav/useGamepadNav'
import styles from './Overlay.module.css'

type View = 'main' | 'options' | 'confirmQuit'

/**
 * Opens on 'game:paused' {reason:'menu'} (HUD button, Esc or Start) and closes on 'game:resumed'.
 * "Riprendi" emits 'resume'; "Abbandona" asks for confirmation and emits 'run:quit'.
 */
export function PauseMenu() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('main')
  const quitSentRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()

  const resume = () => gameBus.emit('resume', undefined)

  const navRef = useGamepadNav({
    enabled: open,
    onBack: () => (view === 'main' ? resume() : setView('main')),
  })

  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el
      navRef(el)
    },
    [navRef],
  )

  useEffect(() => {
    const offPaused = gameBus.on('game:paused', ({ reason }) => {
      if (reason !== 'menu') return
      quitSentRef.current = false
      setView('main')
      setOpen(true)
    })
    const offResumed = gameBus.on('game:resumed', () => setOpen(false))
    return () => {
      offPaused()
      offResumed()
    }
  }, [])

  useEffect(() => {
    if (open) containerRef.current?.querySelector<HTMLElement>('[data-nav]')?.focus()
  }, [open, view])

  const quit = () => {
    if (quitSentRef.current) return
    quitSentRef.current = true
    gameBus.emit('run:quit', undefined)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={setContainer}>
        <h2 id={titleId} className={styles.title}>
          {t('pause.title')}
        </h2>
        {view === 'main' && (
          <div className={styles.menu}>
            <NeonButton variant="primary" block onClick={resume}>
              {t('pause.resume')}
            </NeonButton>
            <NeonButton block onClick={() => setView('options')}>
              {t('pause.options')}
            </NeonButton>
            <NeonButton variant="danger" block onClick={() => setView('confirmQuit')}>
              {t('pause.quit')}
            </NeonButton>
          </div>
        )}
        {view === 'confirmQuit' && (
          <div className={styles.menu}>
            <p>{t('pause.quitConfirm')}</p>
            <NeonButton block onClick={() => setView('main')}>
              {t('pause.quitNo')}
            </NeonButton>
            <NeonButton variant="danger" block onClick={quit}>
              {t('pause.quitYes')}
            </NeonButton>
          </div>
        )}
        {view === 'options' && (
          <Panel title={t('pause.options')}>
            <OptionsPanel inRun />
            <NeonButton onClick={() => setView('main')}>{t('app.back')}</NeonButton>
          </Panel>
        )}
      </div>
    </div>
  )
}
