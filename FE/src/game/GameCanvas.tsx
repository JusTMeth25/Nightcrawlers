// Stub: the Engine agent replaces this with the Phaser game (plan 02, Task 15).
// The props are final: React mounts the game with a RunConfig and gets the RunResult back.
import type { GameCanvasProps, RunResult } from '@shared/types'

export default function GameCanvas({ config, onEnd }: GameCanvasProps) {
  const endRun = () => {
    const result: RunResult = {
      runId: config.runId,
      characterId: config.characterId,
      durationSec: 0,
      kills: 0,
      killsByEnemy: {},
      level: 1,
      eurodollarsCollected: 0,
      weaponsSeen: [],
      enemiesSeen: [],
    }
    onEnd(result)
  }

  return (
    <div data-testid="game-canvas">
      <button type="button" onClick={endRun}>
        Termina run (stub)
      </button>
    </div>
  )
}
