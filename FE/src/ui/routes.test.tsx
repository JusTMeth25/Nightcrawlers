import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OPTIONS } from '@shared/types'
import { setLocale } from './i18n/locale'
import { routes } from './routes'
import { useRun } from './store/run'
import { useSession } from './store/session'

vi.mock('@game/GameCanvas', () => ({ default: () => <div data-testid="game-canvas" /> }))

const initialRun = useRun.getState()

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', locale: 'it' as const }

function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  setLocale('it')
  useRun.setState(initialRun, true)
  useSession.setState({ status: 'unknown', user: null, save: null, accessToken: null, sessionExpired: false })
})

describe('routes', () => {
  it('/account sends a guest to /login', () => {
    useSession.setState({ status: 'guest' })
    const router = at('/account')
    expect(router.state.location.pathname).toBe('/login')
  })

  it('/ripperdoc stays visible to a guest, disabled with an invite to register', () => {
    useSession.setState({ status: 'guest' })
    const router = at('/ripperdoc')
    expect(router.state.location.pathname).toBe('/ripperdoc')
    expect(screen.getByText(/riservato agli utenti registrati/)).toBeInTheDocument()
  })

  it('lets an authenticated user open /account', () => {
    useSession.setState({ status: 'authenticated', user })
    const router = at('/account')
    expect(router.state.location.pathname).toBe('/account')
  })

  it('the not-found page and the footer follow the current locale', () => {
    useSession.setState({ status: 'guest' })
    setLocale('en')
    at('/nowhere')
    expect(screen.getByRole('heading', { name: 'Page not found.' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/not affiliated with CD Projekt/i)
  })

  it('shows the disclaimer in the footer', () => {
    useSession.setState({ status: 'guest' })
    at('/codex')
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/non affiliato a CD Projekt/i)
  })

  it('goes to /login when the session expires', () => {
    useSession.setState({ status: 'authenticated', user })
    const router = at('/')
    expect(router.state.location.pathname).toBe('/')
    // the session store flags the expiry when the refresh fails
    act(() => useSession.setState({ status: 'guest', user: null, sessionExpired: true }))
    expect(router.state.location.pathname).toBe('/login')
    expect(useSession.getState().sessionExpired).toBe(false)
  })
  it.each(['/play', '/game-over'])('does not leave %s when the session expires (the run ends first)', (path) => {
    useSession.setState({ status: 'authenticated', user })
    useRun.setState({
      config: { mode: 'online', runId: 'r1', seed: 1, characterId: 'david', ripperdoc: {}, options: DEFAULT_OPTIONS },
      result: path === '/game-over' ? { runId: 'r1', characterId: 'david', durationSec: 60, kills: 1, killsByEnemy: {}, level: 1, eurodollarsCollected: 0, weaponsSeen: [], enemiesSeen: [] } : null,
      retrySubmit: async () => {},
    })
    const router = at(path)
    expect(router.state.location.pathname).toBe(path)
    act(() => useSession.setState({ status: 'guest', user: null, sessionExpired: true }))
    expect(router.state.location.pathname).not.toBe('/login')
  })
})
