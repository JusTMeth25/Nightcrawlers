import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../../../api'
import type { MockApi } from '../../../api/mock/MockApi'
import VerifyEmailScreen from './VerifyEmailScreen'

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

function renderAt(search: string) {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/verify-email${search}`]}>
        <VerifyEmailScreen />
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('VerifyEmailScreen', () => {
  it('verifies a valid token once, even under StrictMode', async () => {
    const mock = api as MockApi
    await mock.register({ username: 'verify_me', email: 'verify@night.city', password: 'a-very-long-pass' })
    const token = mock.lastEmailToken('verify')
    const spy = vi.spyOn(api, 'verifyEmail')
    renderAt(`?token=${token}`)
    expect(await screen.findByText(/Email verificata/)).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('shows "Link non valido o scaduto" for a bad token', async () => {
    renderAt('?token=nope')
    expect(await screen.findByText('Link non valido o scaduto')).toBeInTheDocument()
  })

  it('shows the error without calling the API when the token is missing', () => {
    const spy = vi.spyOn(api, 'verifyEmail')
    renderAt('')
    expect(screen.getByText('Link non valido o scaduto')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})
