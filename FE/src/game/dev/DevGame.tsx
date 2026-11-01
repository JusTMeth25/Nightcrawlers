// Harness host: the same mount as GameCanvas, plus the harness switches (DevOptions).
import { useRef } from 'react'
import type { RunConfig, RunResult } from '@shared/types'
import type { DevOptions } from '../config'
import { useGame } from '../run/useGame'

export default function DevGame({ config, dev, onEnd }: { config: RunConfig; dev: DevOptions; onEnd: (r: RunResult) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useGame(ref, config, onEnd, dev)
  return <div ref={ref} data-testid="game-canvas" style={{ position: 'fixed', inset: 0 }} />
}
