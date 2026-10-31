// Harness-only host for the Phaser game (GameCanvas takes over in plan Task 15).
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { RunConfig } from '@shared/types'
import { createGameConfig, type DevOptions } from '../config'

export default function DevGame({ config, dev }: { config: RunConfig; dev: DevOptions }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const game = new Phaser.Game(createGameConfig(ref.current, config, dev))
    // headless checks read the game state from here
    ;(window as unknown as { __game?: Phaser.Game }).__game = game
    return () => game.destroy(true)
  }, [config, dev])
  return <div ref={ref} data-testid="game-canvas" style={{ position: 'fixed', inset: 0 }} />
}
