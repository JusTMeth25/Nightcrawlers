// Typed event bus: the only channel between the Phaser game and the React UI.
import type {
  ChestReward,
  GameOptions,
  HudState,
  LevelUpCard,
  RunCheckpoint,
  RunResult,
} from './types'

export interface GameEvents {
  'hud:update': HudState
  'levelup:offer': { cards: LevelUpCard[] }
  'levelup:choose': { index: number }
  'chest:open': ChestReward
  'chest:close': undefined
  'run:checkpoint': RunCheckpoint
  'run:end': RunResult
  // commands UI -> game
  /** open the pause menu */
  pause: undefined
  /** close the pause menu */
  resume: undefined
  /** abandon: the game ends the run at once and emits 'run:end' */
  'run:quit': undefined
  'options:changed': GameOptions
  // notifications game -> UI (also when the pause comes from Esc/Start inside the game)
  'game:paused': { reason: 'menu' | 'levelup' | 'chest' }
  'game:resumed': undefined
}

type Listener<P> = (payload: P) => void

export class EventBus<E> {
  private listeners = new Map<keyof E, Set<Listener<never>>>()

  on<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn as Listener<never>)
    return () => {
      set.delete(fn as Listener<never>)
    }
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of [...set] as Listener<E[K]>[]) {
      try {
        fn(payload)
      } catch (error) {
        console.error(`[gameBus] listener for "${String(event)}" failed`, error)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const gameBus = new EventBus<GameEvents>()
