// The only export towards React: mounts the Phaser run for `config` and reports the end through
// `onEnd` (also published on the bus as run:end). Everything else flows through gameBus.
import { useRef } from 'react'
import type { GameCanvasProps } from '@shared/types'
import { useGame } from './run/useGame'

export default function GameCanvas({ config, onEnd }: GameCanvasProps) {
  const ref = useRef<HTMLDivElement>(null)
  useGame(ref, config, onEnd)
  return <div ref={ref} data-testid="game-canvas" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }} />
}
