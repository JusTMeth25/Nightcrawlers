// Mounts one Phaser game on a div for the lifetime of a RunConfig (GameCanvas and the harness).
// StrictMode mounts twice: each cleanup destroys its game and removes its bus listeners before the
// next mount creates a new one, so at most one game is ever live. Phaser is imported lazily: a
// cleanup that runs before it loaded simply cancels the start.
import { useEffect, useEffectEvent, type RefObject } from 'react'
import type Phaser from 'phaser'
import { gameBus } from '@shared/events'
import type { RunConfig, RunResult } from '@shared/types'
import type { DevOptions } from '../config'
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
    let game: Phaser.Game | null = null
    let cancelled = false
    import('./createGame')
      .then(({ createGame }) => {
        if (cancelled) return
        game = createGame(el, config, session, dev)
        if (dev) {
          // harness only: headless checks read the game state from here
          ;(window as unknown as { __game?: Phaser.Game }).__game = game
        }
      })
      .catch((error: unknown) => console.error('[game] failed to start', error))
    return () => {
      cancelled = true
      offEnd()
      session.dispose()
      game?.destroy(true)
      game = null
    }
  }, [ref, config, dev])
}
