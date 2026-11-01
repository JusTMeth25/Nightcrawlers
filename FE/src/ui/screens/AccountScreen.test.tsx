import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { api } from '../../api'
import { DEMO_LOGIN, DEMO_PASSWORD, UNVERIFIED_LOGIN } from '../../api/mock/MockApi'
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

function renderAccount() {
  const router = createMemoryRouter(
    [
      { path: '/account', element: <AccountScreen /> },
      { path: '/', element: <p>title screen</p> },
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

  it('logout from all devices calls logoutAll', async () => {
    const logoutAll = vi.spyOn(api, 'logoutAll')
    renderAccount()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esci da tutti i dispositivi' }))
    expect(await screen.findByText('title screen')).toBeInTheDocument()
    expect(logoutAll).toHaveBeenCalledTimes(1)
    expect(useSession.getState().status).toBe('guest')
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

  // last: the mock user is gone afterwards
  it('deletes the account with the right password and goes home as guest', async () => {
    const router = renderAccount()
    await askDelete(DEMO_PASSWORD)
    expect(await screen.findByText('title screen')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(useSession.getState().status).toBe('guest')
  })
})
