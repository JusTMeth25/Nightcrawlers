import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../routes'
import { useSession } from '../store/session'

vi.mock('@game/GameCanvas', () => ({ default: () => <div data-testid="game-canvas" /> }))

const user = { id: 'u1', username: 'rookie', email: 'r@x.it', emailVerified: false, createdAt: '2026-01-01T00:00:00Z' }

function at(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

afterEach(() => {
  useSession.setState({ status: 'unknown', user: null, save: null, sessionExpired: false })
})

describe('VerifyBanner', () => {
  it('appears on the screens when the email is not verified, with "Reinvia email"', () => {
    useSession.setState({ status: 'authenticated', user })
    at('/')
    expect(screen.getByText(/Email non verificata/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reinvia email di verifica' })).toBeInTheDocument()
  })

  it('is hidden for verified users and guests', () => {
    useSession.setState({ status: 'authenticated', user: { ...user, emailVerified: true } })
    at('/')
    expect(screen.queryByText(/Email non verificata/)).not.toBeInTheDocument()
  })
})
