import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS, type GameCanvasProps, type RunConfig, type RunResult } from '@shared/types'
import { useRun } from '../store/run'
import PlayScreen from './PlayScreen'

// the real canvas boots Phaser: tests only need the props contract
vi.mock('@game/GameCanvas', () => ({
  default: ({ config, onEnd }: GameCanvasProps) => (
    <div data-testid="game-canvas" data-mode={config.mode}>
      <button
        type="button"
        onClick={() =>
          onEnd({
            runId: config.runId,
            characterId: config.characterId,
            durationSec: 61,
            kills: 3,
            killsByEnemy: {},
            level: 2,
            eurodollarsCollected: 4,
            weaponsSeen: [],
            enemiesSeen: [],
          } satisfies RunResult)
        }
      >
        end
      </button>
    </div>
  ),
}))

const config: RunConfig = { mode: 'guest', runId: null, seed: 7, characterId: 'david', ripperdoc: {}, options: DEFAULT_OPTIONS }
const initialRun = useRun.getState()

function renderPlay() {
  const router = createMemoryRouter(
    [
      { path: '/play', element: <PlayScreen /> },
      { path: '/game-over', element: <p>game over screen</p> },
      { path: '/select', element: <p>select screen</p> },
    ],
    { initialEntries: ['/play'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  useRun.setState(initialRun, true)
  vi.restoreAllMocks()
})

describe('PlayScreen', () => {
  it('without a run config goes back to the character select', () => {
    const router = renderPlay()
    expect(router.state.location.pathname).toBe('/select')
  })

  it('mounts the game with the config and overlays the HUD', () => {
    useRun.setState({ config })
    renderPlay()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-mode', 'guest')
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schermo intero' })).toBeInTheDocument()
  })

  it('forwards run:checkpoint to the run store', () => {
    const onCheckpoint = vi.fn()
    useRun.setState({ config, onCheckpoint })
    renderPlay()
    const c = { elapsedSec: 60, kills: 5, level: 2, eurodollars: 1 }
    act(() => gameBus.emit('run:checkpoint', c))
    expect(onCheckpoint).toHaveBeenCalledWith(c)
  })

  it('on the end of the run calls finish and shows the game over', async () => {
    const finish = vi.fn(async () => {})
    useRun.setState({ config, finish })
    const router = renderPlay()
    await userEvent.setup().click(screen.getByRole('button', { name: 'end' }))
    expect(finish).toHaveBeenCalledTimes(1)
    expect(finish.mock.calls[0]).toEqual([expect.objectContaining({ kills: 3 })])
    expect(router.state.location.pathname).toBe('/game-over')
  })

  it('opens the pause menu on game:paused {reason:"menu"}', () => {
    useRun.setState({ config })
    renderPlay()
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    expect(screen.getByRole('dialog', { name: 'Pausa' })).toBeInTheDocument()
  })

  it('on a vertical touch screen asks to rotate and pauses the game', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('portrait'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const pause = vi.fn()
    const off = gameBus.on('pause', pause)
    useRun.setState({ config })
    renderPlay()
    off()
    vi.unstubAllGlobals()
    expect(screen.getByRole('alertdialog', { name: 'Ruota il dispositivo' })).toBeInTheDocument()
    expect(pause).toHaveBeenCalled()
  })
})
