// Phaser game configuration. The RunConfig rides in the game registry, set before the scenes boot.
import Phaser from 'phaser'
import type { RunConfig, WeaponId } from '@shared/types'
import type { GameSession } from './run/GameSession'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { RunScene } from './scenes/RunScene'
import { TouchControlsScene } from './scenes/TouchControlsScene'

export const RUN_CONFIG_KEY = 'runConfig'
export const DEV_OPTIONS_KEY = 'devOptions'
export const SESSION_KEY = 'gameSession'

/** Harness-only switches (/game-dev.html query string). */
export interface DevOptions {
  /** keep this many enemies alive (performance test) */
  stress?: number
  /** start with these weapons at level 8 (harness `?weapons=all` or a comma list) */
  weapons?: WeaponId[]
  /** start them evolved */
  evolved?: boolean
  /** game clock at start, seconds (harness `?t=595` shows the first boss at 10:00) */
  startSec?: number
  /** start in cyberpsychosis */
  frenzy?: boolean
}

export function createGameConfig(
  parent: HTMLElement,
  run?: RunConfig,
  dev?: DevOptions,
  session?: GameSession,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#07060d',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    // 3 pointers: mouse + two thumbs on the touch sticks
    input: { gamepad: true, activePointers: 3 },
    fps: { target: 60 },
    scene: [BootScene, PreloadScene, RunScene, TouchControlsScene],
    callbacks: {
      preBoot: (game) => {
        if (run) game.registry.set(RUN_CONFIG_KEY, run)
        if (dev) game.registry.set(DEV_OPTIONS_KEY, dev)
        if (session) game.registry.set(SESSION_KEY, session)
      },
    },
  }
}
