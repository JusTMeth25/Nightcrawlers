// Dev harness: runs the game without the UI. Open /game-dev.html with:
//   ?c=<characterId>  ?seed=<n>  ?fps=1 (FPS counter)  ?stress=<n> (keep n enemies alive)  ?weapons=all
// Until plan Task 15 wires GameCanvas, the harness mounts the Phaser game directly.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { characters } from '@data/index'
import { DEFAULT_OPTIONS, type CharacterId, type RunConfig } from '@shared/types'
import type { DevOptions } from '../config'
import DevGame from './DevGame'
import '../../index.css'

const params = new URLSearchParams(location.search)
const requested = params.get('c')
const characterId: CharacterId = characters.some((c) => c.id === requested) ? (requested as CharacterId) : 'david'
const seed = Number(params.get('seed') ?? Date.now() % 2147483647)
const stress = Number(params.get('stress') ?? 0)

const config: RunConfig = {
  mode: 'guest',
  runId: null,
  seed: Number.isFinite(seed) ? seed : 1,
  characterId,
  ripperdoc: {},
  options: { ...DEFAULT_OPTIONS, showFps: params.get('fps') === '1' },
}
const dev: DevOptions = {
  stress: Number.isFinite(stress) && stress > 0 ? Math.min(stress, 400) : 0,
  weaponsAll: params.get('weapons') === 'all',
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevGame config={config} dev={dev} />
  </StrictMode>,
)
