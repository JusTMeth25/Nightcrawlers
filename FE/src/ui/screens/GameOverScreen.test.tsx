import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EndRunResponse, SaveDto } from '@shared/api-contract'
import { DEFAULT_OPTIONS, type RunConfig, type RunResult } from '@shared/types'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import GameOverScreen from './GameOverScreen'

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z' }
const save: SaveDto = {
  eurodollars: 900,
  totalEurodollarsEarned: 900,
  totalKills: 10,
  bestTimeSec: 700,
  unlockedCharacters: ['david', 'lucy', 'rebecca', 'maine'],
  ripperdoc: {},
  killStats: {},
  characterStats: {},
  codex: { enemies: [], weapons: [] },
}
const online: RunConfig = { mode: 'online', runId: 'r1', seed: 1, characterId: 'david', ripperdoc: {}, options: DEFAULT_OPTIONS }
const guest: RunConfig = { ...online, mode: 'guest', runId: null }
const result: RunResult = {
  runId: 'r1',
  characterId: 'david',
  durationSec: 3725,
  kills: 321,
  killsByEnemy: {},
  level: 14,
  eurodollarsCollected: 77,
  weaponsSeen: [],
  enemiesSeen: [],
}
const outcome = (patch: Partial<EndRunResponse> = {}): EndRunResponse => ({
  eurodollarsAwarded: 150,
  newUnlocks: [],
  flagged: false,
  save,
  ...patch,
})

function renderGameOver() {
  const router = createMemoryRouter(
    [
      { path: '/game-over', element: <GameOverScreen /> },
      { path: '/login', element: <p>login screen</p> },
      { path: '/select', element: <p>select screen</p> },
      { path: '/register', element: <p>register screen</p> },
      { path: '/play', element: <p>play screen</p> },
    ],
    { initialEntries: ['/game-over'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const initialRun = useRun.getState()

afterEach(() => {
  vi.restoreAllMocks()
  useRun.setState(initialRun, true)
  useSession.setState({ status: 'unknown', user: null, save: null, accessToken: null, sessionExpired: false })
})

describe('GameOverScreen', () => {
  it('shows the run stats and the new unlocks', () => {
    useSession.setState({ status: 'authenticated', user, save })
    useRun.setState({ config: online, result, outcome: outcome({ newUnlocks: ['maine'] }) })
    renderGameOver()
    expect(screen.getByText('1:02:05')).toBeInTheDocument()
    expect(screen.getByText('321')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('€$ accreditati: 150')).toBeInTheDocument()
    expect(screen.getByText('Maine sbloccato')).toBeInTheDocument()
  })

  it('warns when the run was flagged', () => {
    useSession.setState({ status: 'authenticated', user, save })
    useRun.setState({ config: online, result, outcome: outcome({ flagged: true, eurodollarsAwarded: 0 }) })
    renderGameOver()
    expect(screen.getByText(/Run segnalata come non plausibile/)).toBeInTheDocument()
  })

  it('invites a guest to register', () => {
    useSession.setState({ status: 'guest' })
    useRun.setState({ config: guest, result: { ...result, runId: null } })
    renderGameOver()
    expect(screen.getByText('I progressi degli ospiti non vengono salvati.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrati per salvare le run' })).toHaveAttribute('href', '/register')
  })

  it('offers "Riprova invio" after a failed submit', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    const retrySubmit = vi.fn(async () => {})
    useRun.setState({ config: online, result, submitError: 'Invio del risultato non riuscito.', canRetry: true, retrySubmit })
    renderGameOver()
    expect(screen.getByRole('alert')).toHaveTextContent('Invio del risultato non riuscito.')
    expect(screen.getByText(/resta in memoria/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Riprova invio' }))
    expect(retrySubmit).toHaveBeenCalledTimes(1)
  })

  it('asks to log in again when the session expired during the run, then sends the result', async () => {
    useSession.setState({ status: 'guest', sessionExpired: true })
    const retrySubmit = vi.fn(async () => {})
    useRun.setState({ config: online, result, needsLogin: true, submitError: 'x', retrySubmit })
    const router = renderGameOver()
    expect(useSession.getState().sessionExpired).toBe(false)
    expect(screen.queryByRole('button', { name: 'Riprova invio' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Accedi di nuovo' }))
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: '/game-over', expired: true })
  })

  it('sends the kept result automatically once logged in again', () => {
    useSession.setState({ status: 'authenticated', user, save })
    const retrySubmit = vi.fn(async () => {})
    useRun.setState({ config: online, result, needsLogin: true, retrySubmit })
    renderGameOver()
    expect(retrySubmit).toHaveBeenCalledTimes(1)
  })

  it('without a finished run goes back to the character select', () => {
    const router = renderGameOver()
    expect(router.state.location.pathname).toBe('/select')
  })
  it('"Gioca ancora" stays on the game over while starting, then opens the game', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    let resolve: (v: 'started') => void = () => {}
    const start = vi.fn(() => new Promise<'started'>((r) => (resolve = r)))
    useRun.setState({ config: online, result, outcome: outcome(), start })
    const router = renderGameOver()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gioca ancora' }))
    expect(start).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/game-over')
    expect(screen.getByRole('button', { name: 'Gioca ancora' })).toBeDisabled()
    await act(async () => resolve('started'))
    expect(router.state.location.pathname).toBe('/play')
  })

  it('"Gioca ancora" failing shows the start error and stays on the result', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    const start = vi.fn(async () => {
      useRun.setState({ startError: 'Impossibile contattare il server.' })
      return 'error' as const
    })
    useRun.setState({ config: online, result, outcome: outcome(), start })
    const router = renderGameOver()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gioca ancora' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile contattare il server.')
    expect(router.state.location.pathname).toBe('/game-over')
    expect(screen.getByRole('button', { name: 'Gioca ancora' })).toBeEnabled()
  })
})
