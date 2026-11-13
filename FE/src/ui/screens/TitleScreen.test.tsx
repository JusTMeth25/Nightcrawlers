import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/locale'
import { useSession } from '../store/session'
import TitleScreen from './TitleScreen'

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', locale: 'it' as const }

function renderTitle() {
  return render(
    <MemoryRouter>
      <TitleScreen />
    </MemoryRouter>,
  )
}

afterEach(() => {
  setLocale('it')
  useSession.setState({ status: 'unknown', user: null, save: null, accessToken: null })
})

describe('TitleScreen', () => {
  it('shows the logo, the menu and the fan game disclaimer', () => {
    useSession.setState({ status: 'guest' })
    renderTitle()
    expect(screen.getByRole('heading', { name: 'NIGHTCRAWLERS' })).toBeInTheDocument()
    for (const name of ['Gioca', 'Ripperdoc', 'Codex', 'Opzioni']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByText(/non affiliato a CD Projekt/i)).toBeInTheDocument()
  })

  it.each([
    ['en', ['Play', 'Log in', 'Ripperdoc', 'Codex', 'Options'], /not affiliated with CD Projekt/],
    ['es', ['Jugar', 'Iniciar sesión', 'Ripperdoc', 'Codex', 'Opciones'], /no afiliado a CD Projekt/],
  ] as const)('renders menu and disclaimer in %s', (locale, links, disclaimer) => {
    setLocale(locale)
    useSession.setState({ status: 'guest' })
    renderTitle()
    expect(screen.getByRole('heading', { name: 'NIGHTCRAWLERS' })).toBeInTheDocument()
    for (const name of links) expect(screen.getByRole('link', { name })).toBeInTheDocument()
    expect(screen.getByText(disclaimer)).toBeInTheDocument()
  })

  it('offers "Accedi" to a guest', () => {
    useSession.setState({ status: 'guest' })
    renderTitle()
    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
  })

  it('offers "Account" to an authenticated user', () => {
    useSession.setState({ status: 'authenticated', user })
    renderTitle()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('link', { name: 'Accedi' })).not.toBeInTheDocument()
  })
})
