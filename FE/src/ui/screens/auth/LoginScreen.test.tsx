import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../api'
import { ApiError } from '../../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD } from '../../../api/mock/MockApi'
import { useSession } from '../../store/session'
import LoginScreen from './LoginScreen'

vi.mock('../../../api', async () => {
  const { createAuthBridge } = await import('../../../api/auth')
  const { MockApi } = await import('../../../api/mock/MockApi')
  const errors = await import('../../../api/errors')
  const authBridge = createAuthBridge()
  return {
    authBridge,
    api: new MockApi({ auth: authBridge, latencyMs: 0, log: () => {} }),
    isMockApi: true,
    ApiError: errors.ApiError,
    isApiError: errors.isApiError,
  }
})

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginScreen /> },
      { path: '/select', element: <p>select screen</p> },
    ],
    { initialEntries: ['/login'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function submit(login: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Username o email'), login)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Accedi' }))
}

afterEach(async () => {
  vi.restoreAllMocks()
  await useSession.getState().logout()
  useSession.setState({ status: 'guest' })
})

describe('LoginScreen', () => {
  it('uses the right autocomplete attributes', () => {
    renderLogin()
    expect(screen.getByLabelText('Username o email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('shows "Credenziali non valide" for wrong credentials', async () => {
    renderLogin()
    await submit(DEMO_LOGIN, 'wrong-password-000')
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenziali non valide')
    expect(useSession.getState().status).not.toBe('authenticated')
  })

  it('shows the lock time for 423', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(new ApiError(423, null, 60))
    renderLogin()
    await submit(DEMO_LOGIN, DEMO_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account bloccato temporaneamente, riprova tra 60 secondi',
    )
  })

  it('shows the rate limit for 429', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(new ApiError(429, null, 30))
    renderLogin()
    await submit(DEMO_LOGIN, DEMO_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent('Troppi tentativi, riprova tra 30 secondi')
  })

  it('shows a network error for status 0', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(new ApiError(0, null, null))
    renderLogin()
    await submit(DEMO_LOGIN, DEMO_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossibile contattare il server/)
  })

  it('logs in and goes to /select', async () => {
    const router = renderLogin()
    await submit(DEMO_LOGIN, DEMO_PASSWORD)
    expect(await screen.findByText('select screen')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/select')
    expect(useSession.getState().status).toBe('authenticated')
  })

  it('requires both fields before calling the API', async () => {
    const login = vi.spyOn(api, 'login')
    renderLogin()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accedi' }))
    expect(screen.getAllByText('Campo obbligatorio')).toHaveLength(2)
    expect(login).not.toHaveBeenCalled()
  })
})
