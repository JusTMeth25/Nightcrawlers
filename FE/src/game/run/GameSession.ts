// One mounted game, without Phaser: owns the bus side of the run (pause state, quit, options,
// the single run:end). GameCanvas creates it; RunScene links to it once it exists.
import type { EventBus, GameEvents } from '@shared/events'
import type { GameOptions, RunConfig, RunResult } from '@shared/types'
import { PauseState } from './PauseState'

export interface SceneLink {
  /** a level-up or chest is pending or shown */
  modalOpen(): boolean
  /** the run's data so far */
  result(): RunResult
  applyOptions(options: GameOptions): void
}

export function emptyResult(config: RunConfig): RunResult {
  return {
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
}

export class GameSession {
  readonly pause: PauseState
  private readonly bus: EventBus<GameEvents>
  private readonly config: RunConfig
  private scene: SceneLink | null = null
  private ended = false
  private currentOptions: GameOptions
  private readonly off: (() => void)[]

  constructor(bus: EventBus<GameEvents>, config: RunConfig) {
    this.bus = bus
    this.config = config
    this.currentOptions = config.options
    this.pause = new PauseState(bus, () => this.scene?.modalOpen() ?? false)
    this.off = [
      bus.on('run:quit', () => this.end(this.scene?.result() ?? emptyResult(this.config))),
      bus.on('options:changed', (o) => {
        this.currentOptions = o
        this.scene?.applyOptions(o)
      }),
    ]
  }

  /** latest options (the scene reads them at start) */
  get options(): GameOptions {
    return this.currentOptions
  }

  get isEnded(): boolean {
    return this.ended
  }

  /** Returns the unlink function. */
  link(scene: SceneLink): () => void {
    this.scene = scene
    return () => {
      if (this.scene === scene) this.scene = null
    }
  }

  /** Emits run:end once; later calls are ignored. */
  end(result: RunResult): void {
    if (this.ended) return
    this.ended = true
    this.bus.emit('run:end', result)
  }

  dispose(): void {
    for (const off of this.off) off()
    this.off.length = 0
    this.pause.dispose()
    this.scene = null
  }
}
