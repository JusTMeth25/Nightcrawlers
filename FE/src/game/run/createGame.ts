// Loaded on demand by useGame: keeps Phaser (and its canvas checks at import) out of the UI
// bundle and out of every module that only imports GameCanvas.
import Phaser from 'phaser'
import type { RunConfig } from '@shared/types'
import { createGameConfig, type DevOptions } from '../config'
import type { GameSession } from './GameSession'

export function createGame(el: HTMLElement, config: RunConfig, session: GameSession, dev?: DevOptions): Phaser.Game {
  return new Phaser.Game(createGameConfig(el, config, dev, session))
}
