import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import GameCanvas from '@game/GameCanvas'
import { gameBus } from '@shared/events'
import type { RunResult } from '@shared/types'
import { ChestModal } from '../hud/ChestModal'
import { Hud } from '../hud/Hud'
import { LevelUpModal } from '../hud/LevelUpModal'
import { PauseMenu } from '../hud/PauseMenu'
import { t } from '../i18n/it'
import { useRun } from '../store/run'
import styles from './PlayScreen.module.css'
import { RotateDevice } from './RotateDevice'
import { usePortraitTouch } from './usePortraitTouch'

function useFullscreen() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  return active
}

/**
 * The game with its React overlays. No menu gamepad navigation here: the pad drives the game,
 * and the overlays (level-up, chest, pause) enable their own navigation while open.
 */
export default function PlayScreen() {
  const navigate = useNavigate()
  const config = useRun((s) => s.config)
  const finished = useRun((s) => s.result !== null)
  const finish = useRun((s) => s.finish)
  const onCheckpoint = useRun((s) => s.onCheckpoint)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fullscreen = useFullscreen()
  const portrait = usePortraitTouch()

  useEffect(() => gameBus.on('run:checkpoint', (c) => onCheckpoint(c)), [onCheckpoint])

  // turning the phone upright pauses the game (the pause menu waits under the rotate notice).
  // The engine may not listen yet when /play mounts: ask again on every hud:update until it
  // confirms the pause menu, and again if the game resumes while still upright.
  useEffect(() => {
    if (!portrait) return
    let confirmed = false
    const ask = () => {
      if (!confirmed) gameBus.emit('pause', undefined)
    }
    const offs = [
      gameBus.on('hud:update', ask),
      gameBus.on('game:paused', ({ reason }) => {
        if (reason === 'menu') confirmed = true
      }),
      gameBus.on('game:resumed', () => {
        confirmed = false
        ask()
      }),
    ]
    ask()
    return () => offs.forEach((off) => off())
  }, [portrait])

  const onEnd = useCallback(
    (result: RunResult) => {
      void finish(result)
      navigate('/game-over', { replace: true })
    },
    [finish, navigate],
  )

  const toggleFullscreen = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    else void containerRef.current?.requestFullscreen?.().catch(() => {})
  }

  if (!config) return <Navigate to="/select" replace />
  // the config stays after the end (retry, game over): never restart the same runId/seed
  if (finished) return <Navigate to="/game-over" replace />

  return (
    <div className={styles.play} ref={containerRef}>
      <GameCanvas key={`${config.runId ?? 'guest'}-${config.seed}`} config={config} onEnd={onEnd} />
      <Hud
        characterId={config.characterId}
        controls={
          <button
            type="button"
            className={styles.control}
            aria-label={fullscreen ? t('play.exitFullscreen') : t('play.fullscreen')}
            onClick={toggleFullscreen}
          >
            {fullscreen ? '⤡' : '⤢'}
          </button>
        }
      />
      <LevelUpModal />
      <ChestModal />
      <PauseMenu />
      {portrait && <RotateDevice />}
    </div>
  )
}
