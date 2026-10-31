import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { routes } from './routes'
import { useSession } from './store/session'

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z' }

function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  useSession.setState({ status: 'unknown', user: null, save: null, accessToken: null, sessionExpired: false })
})

describe('routes', () => {
  it.each(['/ripperdoc', '/account'])('%s sends a guest to /login', (path) => {
    useSession.setState({ status: 'guest' })
    const router = at(path)
    expect(router.state.location.pathname).toBe('/login')
  })

  it('lets an authenticated user open /account', () => {
    useSession.setState({ status: 'authenticated', user })
    const router = at('/account')
    expect(router.state.location.pathname).toBe('/account')
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
})
