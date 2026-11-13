import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../api'
import { problemError } from '../../../api/errors'
import { setLocale } from '../../i18n/locale'
import RegisterScreen from './RegisterScreen'

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

function renderRegister() {
  render(
    <MemoryRouter>
      <RegisterScreen />
    </MemoryRouter>,
  )
}

async function fill(username: string, email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Username'), username)
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Crea account' }))
}

afterEach(() => {
  setLocale('it')
  vi.restoreAllMocks()
})

describe('RegisterScreen', () => {
  it('sends the current locale with the registration', async () => {
    const register = vi.spyOn(api, 'register')
    renderRegister()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Username'), 'nuevo_user')
    await user.type(screen.getByLabelText('Email'), 'nuevo@x.test')
    await user.type(screen.getByLabelText('Password'), 'una-password-lunga')
    // the locale at submit time is sent (labels stay as rendered until the next render)
    setLocale('es')
    await user.click(screen.getByRole('button', { name: 'Crea account' }))
    expect(register).toHaveBeenCalledWith({
      username: 'nuevo_user',
      email: 'nuevo@x.test',
      password: 'una-password-lunga',
      locale: 'es',
    })
  })

  it('uses the right autocomplete attributes', () => {
    renderRegister()
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('shows 409 as an error under the username field', async () => {
    renderRegister()
    await fill('demo', 'someone@night.city', 'a-very-long-pass')
    const field = screen.getByLabelText('Username')
    expect(await screen.findByText('Username già in uso')).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field.getAttribute('aria-describedby')).toContain(screen.getByText('Username già in uso').id)
  })

  it('shows "Controlla la tua email" after a successful registration', async () => {
    renderRegister()
    await fill('new_runner', 'runner@night.city', 'a-very-long-pass')
    expect(await screen.findByRole('heading', { name: 'Controlla la tua email' })).toBeInTheDocument()
  })

  it('validates on the client before calling the API', async () => {
    const register = vi.spyOn(api, 'register')
    renderRegister()
    await fill('x', 'nope', 'short')
    expect(screen.getByText('Da 3 a 20 caratteri: lettere, numeri o _')).toBeInTheDocument()
    expect(screen.getByText('Indirizzo email non valido')).toBeInTheDocument()
    expect(screen.getByText('La password deve avere tra 12 e 128 caratteri')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows server field errors (400, e.g. common password) on the field', async () => {
    vi.spyOn(api, 'register').mockRejectedValueOnce(
      problemError(400, 'Dati non validi', { password: 'Password troppo comune' }),
    )
    renderRegister()
    await fill('new_runner', 'runner@night.city', 'password1234')
    expect(await screen.findByText('Password troppo comune')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })
})
