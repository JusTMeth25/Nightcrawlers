import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useSession } from './ui/store/session'

const initial = useSession.getState()

afterEach(() => {
  useSession.setState({ ...initial, status: 'unknown', bootstrapFailed: false })
})

describe('App bootstrap', () => {
  it('shows a spinner while the session is restored', () => {
    useSession.setState({ status: 'unknown', bootstrapFailed: false })
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('offers retry or guest play when the refresh could not be reached', async () => {
    const bootstrap = vi.fn(async () => {})
    useSession.setState({ status: 'unknown', bootstrapFailed: true, bootstrap })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Impossibile contattare il server/)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(bootstrap).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Gioca come ospite' }))
    expect(useSession.getState().status).toBe('guest')
  })
})
