// Dev harness: runs the game without the UI. Open /game-dev.html?c=<characterId>&seed=<n>
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { characters } from '@data/index'
import { DEFAULT_OPTIONS, type CharacterId, type RunConfig } from '@shared/types'
import GameCanvas from '../GameCanvas'
import '../../index.css'

const params = new URLSearchParams(location.search)
const requested = params.get('c')
const characterId: CharacterId = characters.some((c) => c.id === requested) ? (requested as CharacterId) : 'david'
const seed = Number(params.get('seed') ?? Date.now() % 2147483647)

const config: RunConfig = {
  mode: 'guest',
  runId: null,
  seed: Number.isFinite(seed) ? seed : 1,
  characterId,
  ripperdoc: {},
  options: DEFAULT_OPTIONS,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameCanvas config={config} onEnd={(result) => console.info('[harness] run:end', result)} />
  </StrictMode>,
)
