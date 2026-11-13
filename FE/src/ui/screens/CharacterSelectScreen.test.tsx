import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveDto } from '@shared/api-contract'
import { DEFAULT_OPTIONS } from '@shared/types'
import { setLocale } from '../i18n/locale'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import CharacterSelectScreen from './CharacterSelectScreen'

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', locale: 'it' as const }
const save: SaveDto = {
  eurodollars: 0,
  totalEurodollarsEarned: 0,
  totalKills: 0,
  bestTimeSec: 0,
  unlockedCharacters: ['david', 'lucy', 'rebecca'],
  ripperdoc: {},
  killStats: { maxtac: 12 },
  characterStats: {},
  codex: { enemies: [], weapons: [] },
}

function renderSelect() {
  const router = createMemoryRouter(
    [
      { path: '/select', element: <CharacterSelectScreen /> },
      { path: '/play', element: <p>play screen</p> },
      { path: '/', element: <p>title</p> },
    ],
    { initialEntries: ['/select'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  // the atlas cannot load in tests: portraits use the neon placeholder
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
})

const initialRun = useRun.getState()

afterEach(() => {
  setLocale('it')
  vi.unstubAllGlobals()
  useRun.setState(initialRun, true)
  useSession.setState({ status: 'unknown', user: null, save: null, accessToken: null })
  useRun.getState().reset()
  useRun.setState({ characterId: null })
})

describe('CharacterSelectScreen', () => {
  it('disables "Avvia" for a locked character', async () => {
    useSession.setState({ status: 'guest' })
    renderSelect()
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: /Maine/ }))
    expect(screen.getByRole('button', { name: 'Avvia' })).toBeDisabled()
    expect(screen.getByText('Registrati per sbloccare nuovi personaggi.')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Lucy/ }))
    expect(screen.getByRole('button', { name: 'Avvia' })).toBeEnabled()
  })

  it('shows weapon, skill and requirement in English', async () => {
    setLocale('en')
    useSession.setState({ status: 'authenticated', user, save })
    renderSelect()
    expect(screen.getByRole('heading', { name: 'Choose your edgerunner' })).toBeInTheDocument()
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: /Kiwi/ }))
    expect(screen.getByText('Smart Pistol')).toBeInTheDocument()
    expect(screen.getByText('Snipe')).toBeInTheDocument()
    expect(screen.getByText(/A piercing shot with extreme damage\./)).toBeInTheDocument()
    expect(screen.getByText('Kill 50 MaxTac agents in total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  })

  it('shows weapon, skill and requirement in Spanish', async () => {
    setLocale('es')
    useSession.setState({ status: 'authenticated', user, save })
    renderSelect()
    expect(screen.getByRole('heading', { name: 'Elige a tu edgerunner' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Pilar/ }))
    expect(screen.getByText('Lanzagranadas')).toBeInTheDocument()
    expect(screen.getByText('Granada de racimo')).toBeInTheDocument()
    expect(screen.getByText('Reúne 5.000 €$ en total')).toBeInTheDocument()
    expect(screen.getByText('Progreso: 0 / 5.000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled()
  })

  it('lets an unlocked Kiwi start now that every character has a sprite', async () => {
    useSession.setState({
      status: 'authenticated',
      user,
      save: { ...save, unlockedCharacters: [...save.unlockedCharacters, 'kiwi'] },
    })
    renderSelect()
    const kiwi = screen.getByRole('button', { name: /Kiwi/ })
    expect(within(kiwi).queryByText('Segnale criptato')).not.toBeInTheDocument()
    await userEvent.setup().click(kiwi)
    expect(screen.getByRole('button', { name: 'Avvia' })).toBeEnabled()
  })

  it('shows the unlock progress with a progress bar', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    renderSelect()
    await userEvent.setup().click(screen.getByRole('button', { name: /Kiwi/ }))
    const bar = screen.getByRole('progressbar', { name: 'Uccidi 50 agenti MaxTac in totale' })
    expect(bar).toHaveAttribute('aria-valuenow', '12')
    expect(bar).toHaveAttribute('aria-valuemax', '50')
  })

  it('shows weapon, skill and bonus of the selected character', () => {
    useSession.setState({ status: 'guest' })
    renderSelect()
    expect(screen.getByText('Sandevistan')).toBeInTheDocument()
    expect(screen.getByText('+10% velocità')).toBeInTheDocument()
  })
  it('"Avvia" starts the run and opens the game', async () => {
    useSession.setState({ status: 'guest' })
    const start = vi.fn(async () => 'started' as const)
    useRun.setState({ start })
    const router = renderSelect()
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: /Rebecca/ }))
    await u.click(screen.getByRole('button', { name: 'Avvia' }))
    expect(useRun.getState().characterId).toBe('rebecca')
    expect(start).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/play')
  })

  it('unverified email: explains it and offers guest play or a new email', async () => {
    useSession.setState({ status: 'authenticated', user: { ...user, emailVerified: false }, save })
    const startGuest = vi.fn(() => 'started' as const)
    useRun.setState({ start: vi.fn(async () => 'needs_verification' as const), startGuest })
    const router = renderSelect()
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Avvia' }))
    expect(await screen.findByText(/Verifica la tua email per salvare le run online/)).toBeInTheDocument()
    // the resend button lives in the VerifyBanner of the shell, not twice on this screen
    expect(screen.queryByRole('button', { name: 'Reinvia email di verifica' })).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Gioca come ospite' }))
    expect(startGuest).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/play')
  })

  it('shows the start error', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    useRun.setState({
      start: vi.fn(async () => {
        useRun.setState({ startError: 'Impossibile contattare il server.' })
        return 'error' as const
      }),
    })
    renderSelect()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Avvia' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile contattare il server.')
  })
  it('unverified email with a non-starter: explains why guest play is disabled', async () => {
    useSession.setState({ status: 'authenticated', user: { ...user, emailVerified: false }, save: { ...save, unlockedCharacters: [...save.unlockedCharacters, 'maine'] } })
    useRun.setState({ start: vi.fn(async () => 'needs_verification' as const) })
    renderSelect()
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: /Maine/ }))
    await u.click(screen.getByRole('button', { name: 'Avvia' }))
    expect(await screen.findByRole('button', { name: 'Gioca come ospite' })).toBeDisabled()
    expect(screen.getByText('Come ospite puoi usare solo i personaggi iniziali.')).toBeInTheDocument()
  })

  it('shows a start error set elsewhere (e.g. "Gioca ancora")', () => {
    useSession.setState({ status: 'authenticated', user, save })
    useRun.setState({ startError: 'Impossibile contattare il server.' })
    renderSelect()
    expect(screen.getByRole('alert')).toHaveTextContent('Impossibile contattare il server.')
  })

  it('with an unsent online result: blocks a new run and offers to send it', async () => {
    useSession.setState({ status: 'authenticated', user, save })
    const retrySubmit = vi.fn(async () => {})
    useRun.setState({
      config: { mode: 'online', runId: 'r1', seed: 1, characterId: 'david', ripperdoc: {}, options: DEFAULT_OPTIONS },
      result: { runId: 'r1', characterId: 'david', durationSec: 60, kills: 1, killsByEnemy: {}, level: 1, eurodollarsCollected: 0, weaponsSeen: [], enemiesSeen: [] },
      submitError: 'Invio del risultato non riuscito.',
      canRetry: true,
      retrySubmit,
    })
    renderSelect()
    expect(screen.getByText(/Risultato non inviato/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avvia' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Vai al risultato' })).toHaveAttribute('href', '/game-over')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Riprova invio' }))
    expect(retrySubmit).toHaveBeenCalledTimes(1)
  })
})
