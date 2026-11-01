import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { api, authBridge } from '../../api'
import { ApiError, problemError } from '../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD, UNVERIFIED_LOGIN } from '../../api/mock/MockApi'
import { RequireAuth } from '../layout/AppShell'
import { useSession } from '../store/session'
import AccountScreen from './AccountScreen'

vi.mock('../../api', async () => {
  const { createAuthBridge } = await import('../../api/auth')
  const { MockApi } = await import('../../api/mock/MockApi')
  const errors = await import('../../api/errors')
  const authBridge = createAuthBridge()
  return {
    authBridge,
    api: new MockApi({ auth: authBridge, latencyMs: 0, log: () => {} }),
    isMockApi: true,
    ApiError: errors.ApiError,
    isApiError: errors.isApiError,
  }
})

/** Same guard as the app: /account under RequireAuth, guests are sent to /login. */
function renderAccount() {
  const router = createMemoryRouter(
    [
      { element: <RequireAuth />, children: [{ path: '/account', element: <AccountScreen /> }] },
      { path: '/', element: <p>title screen</p> },
      { path: '/login', element: <p>login screen</p> },
    ],
    { initialEntries: ['/account'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(async () => {
  await useSession.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await useSession.getState().logout()
})

/** The sign-out navigation must win over the RequireAuth redirect to /login. */
async function expectSignedOutAtHome(router: ReturnType<typeof renderAccount>) {
  await vi.waitFor(() => expect(useSession.getState().status).toBe('guest'))
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(router.state.location.pathname).toBe('/')
  expect(screen.getByText('title screen')).toBeInTheDocument()
  expect(screen.queryByText('login screen')).not.toBeInTheDocument()
}

async function askDelete(password: string) {
  const u = userEvent.setup()
  await u.click(screen.getByRole('button', { name: 'Elimina account' }))
  await u.type(screen.getByLabelText('Password'), password)
  await u.click(screen.getByRole('button', { name: 'Elimina definitivamente' }))
}

describe('AccountScreen', () => {
  it('shows username, email and verification status', () => {
    renderAccount()
    expect(screen.getByText('demo')).toBeInTheDocument()
    expect(screen.getByText('demo@nightcrawlers.test')).toBeInTheDocument()
    expect(screen.getByText('Verificata')).toBeInTheDocument()
  })

  it('wrong password on delete (403): "Password errata", no refresh, still logged in', async () => {
    const refresh = vi.spyOn(api, 'refresh')
    const del = vi.spyOn(api, 'deleteAccount')
    renderAccount()
    await askDelete('wrong-password-000')
    expect(await screen.findByRole('alert')).toHaveTextContent('Password errata')
    expect(del).toHaveBeenCalledWith({ password: 'wrong-password-000' })
    expect(refresh).not.toHaveBeenCalled()
    expect(useSession.getState().status).toBe('authenticated')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('exports the data as a downloaded JSON file', async () => {
    const createObjectURL = vi.fn(() => 'blob:nc-export')
    const revokeObjectURL = vi.fn()
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL }
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    onTestFinished(() => {
      Object.assign(URL, original)
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderAccount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esporta i miei dati' }))
    expect(await screen.findByText('Esportazione scaricata.')).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('nightcrawlers-export.json')
    expect(anchor.href).toBe('blob:nc-export')
  })

  it('logout ends the session and goes home', async () => {
    const router = renderAccount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esci' }))
    expect(await screen.findByText('title screen')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(useSession.getState().status).toBe('guest')
  })

  it('logout from all devices calls logoutAll and lands on the title screen (not /login)', async () => {
    const logoutAll = vi.spyOn(api, 'logoutAll')
    const router = renderAccount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esci da tutti i dispositivi' }))
    await expectSignedOutAtHome(router)
    expect(logoutAll).toHaveBeenCalledTimes(1)
  })

  it('an unverified user sees the status and can resend the email', async () => {
    await useSession.getState().logout()
    await useSession.getState().login({ login: UNVERIFIED_LOGIN, password: DEMO_PASSWORD })
    const resend = vi.spyOn(api, 'resendVerification')
    renderAccount()
    expect(screen.getByText('Non verificata')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reinvia email di verifica' }))
    expect(resend).toHaveBeenCalledTimes(1)
  })

  it('delete while locked (423): shows the lock time from Retry-After, still logged in', async () => {
    vi.spyOn(api, 'deleteAccount').mockRejectedValueOnce(problemError(423, 'Account bloccato', undefined, 120))
    renderAccount()
    await askDelete('wrong-password-000')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account temporaneamente bloccato, riprova tra 120 secondi',
    )
    expect(useSession.getState().status).toBe('authenticated')
  })

  it('delete while locked (423) without Retry-After: asks to retry later', async () => {
    vi.spyOn(api, 'deleteAccount').mockRejectedValueOnce(problemError(423, 'Account bloccato'))
    renderAccount()
    await askDelete('wrong-password-000')
    expect(await screen.findByRole('alert')).toHaveTextContent('Account temporaneamente bloccato, riprova più tardi')
  })

  it('after the lock revoked the sessions, a call that ends the session leads to the login', async () => {
    vi.spyOn(api, 'deleteAccount').mockRejectedValueOnce(problemError(423, 'Account bloccato', undefined, 60))
    vi.spyOn(api, 'exportData').mockImplementationOnce(async () => {
      authBridge.authLost() // refresh answered 401: the backend revoked every session
      throw new ApiError(401, null, null)
    })
    const router = createMemoryRouter(
      [
        { element: <RequireAuth />, children: [{ path: '/account', element: <AccountScreen /> }] },
        { path: '/login', element: <p>login screen</p> },
      ],
      { initialEntries: ['/account'] },
    )
    render(<RouterProvider router={router} />)
    await askDelete('wrong-password-000')
    expect(await screen.findByRole('alert')).toHaveTextContent('riprova tra 60 secondi')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esporta i miei dati' }))
    expect(await screen.findByText('login screen')).toBeInTheDocument()
    expect(useSession.getState()).toMatchObject({ status: 'guest', sessionExpired: true })
  })

  it('a 409 lock conflict on delete shows a retryable error; the next attempt succeeds', async () => {
    const del = vi
      .spyOn(api, 'deleteAccount')
      .mockRejectedValueOnce(problemError(409, 'Conflitto'))
      .mockResolvedValueOnce(undefined) // keeps the shared mock user for the last test
    const router = renderAccount()
    await askDelete(DEMO_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent('Riprova')
    expect(router.state.location.pathname).toBe('/account')
    expect(useSession.getState().status).toBe('authenticated')
    // the confirmation form is still open: type the password again and retry
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await u.click(screen.getByRole('button', { name: 'Elimina definitivamente' }))
    expect(await screen.findByText('title screen')).toBeInTheDocument()
    expect(del).toHaveBeenCalledTimes(2)
  })

  it('an unexpected server error shows its code so the user can report it', async () => {
    vi.spyOn(api, 'exportData').mockRejectedValueOnce(
      new ApiError(500, { type: 'about:blank', title: 'Errore interno', status: 500, errorId: 'f00d-42' }, null),
    )
    renderAccount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esporta i miei dati' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Qualcosa è andato storto. Riprova. (codice: f00d-42)')
  })

  // last: the mock user is gone afterwards
  it('deletes the account with the right password and goes home as guest', async () => {
    const router = renderAccount()
    await askDelete(DEMO_PASSWORD)
    await expectSignedOutAtHome(router)
  })
})
