// Mounts one Phaser game on a div for the lifetime of a RunConfig (GameCanvas and the harness).
// StrictMode mounts twice: each cleanup destroys its game and removes its bus listeners before the
// next mount creates a new one, so at most one game is ever live.
import { useEffect, useEffectEvent, type RefObject } from 'react'
import Phaser from 'phaser'
import { gameBus } from '@shared/events'
import type { RunConfig, RunResult } from '@shared/types'
import { createGameConfig, type DevOptions } from '../config'
import { GameSession } from './GameSession'

export function useGame(
  ref: RefObject<HTMLDivElement | null>,
  config: RunConfig,
  onEnd: (result: RunResult) => void,
  dev?: DevOptions,
): void {
  const handleEnd = useEffectEvent(onEnd)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const session = new GameSession(gameBus, config)
    let reported = false
    const offEnd = gameBus.on('run:end', (result) => {
      if (reported) return
      reported = true
      handleEnd(result)
    })
    const game = new Phaser.Game(createGameConfig(el, config, dev, session))
    if (dev) {
      // harness only: headless checks read the game state from here
      ;(window as unknown as { __game?: Phaser.Game }).__game = game
    }
    return () => {
      offEnd()
      session.dispose()
      game.destroy(true)
    }
  }, [ref, config, dev])
}
