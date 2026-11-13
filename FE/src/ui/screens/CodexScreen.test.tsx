import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { getEnemy, getWeapon } from '@data'
import type { SaveDto } from '@shared/api-contract'
import { setLocale } from '../i18n/locale'
import { useRun } from '../store/run'
import { useSession } from '../store/session'
import CodexScreen from './CodexScreen'

const user = { id: 'u1', username: 'demo', email: 'demo@x.it', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', locale: 'it' as const }
const save: SaveDto = {
  eurodollars: 0,
  totalEurodollarsEarned: 0,
  totalKills: 0,
  bestTimeSec: 0,
  unlockedCharacters: ['david', 'lucy', 'rebecca'],
  ripperdoc: {},
  killStats: { maelstrom: 12345 },
  characterStats: {},
  codex: { enemies: ['maelstrom'], weapons: ['pistol'] },
}
const initialRun = useRun.getState()

function renderCodex() {
  const router = createMemoryRouter([{ path: '/codex', element: <CodexScreen /> }], { initialEntries: ['/codex'] })
  render(<RouterProvider router={router} />)
}

afterEach(() => {
  setLocale('it')
  useRun.setState(initialRun, true)
  useSession.setState({ status: 'unknown', user: null, save: null })
})

describe('CodexScreen', () => {
  it('registered: discovered entries from save.codex with kills, the rest as ???', () => {
    useSession.setState({ status: 'authenticated', user, save })
    renderCodex()
    const enemies = screen.getByRole('list', { name: 'Nemici' })
    expect(within(enemies).getByText(getEnemy('maelstrom').name)).toBeInTheDocument()
    expect(within(enemies).getByText('Uccisi: 12.345')).toBeInTheDocument()
    expect(within(enemies).queryByText(getEnemy('arasaka').name)).not.toBeInTheDocument()
    expect(within(enemies).getAllByText('???')).toHaveLength(3)
    const weapons = screen.getByRole('list', { name: 'Armi' })
    expect(within(weapons).getByText(getWeapon('pistol').name)).toBeInTheDocument()
    expect(within(weapons).getAllByText('???')).toHaveLength(8)
  })

  it('English: enemy and weapon names, descriptions and numbers follow the locale', () => {
    setLocale('en')
    useSession.setState({ status: 'authenticated', user, save })
    renderCodex()
    const enemies = screen.getByRole('list', { name: 'Enemies' })
    expect(within(enemies).getByText('Maelstrom Ganger')).toBeInTheDocument()
    expect(within(enemies).getByText('Killed: 12,345')).toBeInTheDocument()
    const weapons = screen.getByRole('list', { name: 'Weapons' })
    expect(within(weapons).getByText('Pistol')).toBeInTheDocument()
    expect(within(weapons).getByText('Single shots in the aiming direction.')).toBeInTheDocument()
    expect(within(weapons).getByText('Evolution: Overclocked Pistol')).toBeInTheDocument()
  })

  it('guest: uses what was met in the guest runs of this page', () => {
    useSession.setState({ status: 'guest' })
    useRun.setState({ guestCodex: { enemies: ['arasaka'], weapons: [] } })
    renderCodex()
    const enemies = screen.getByRole('list', { name: 'Nemici' })
    expect(within(enemies).getByText(getEnemy('arasaka').name)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Armi' })).getAllByText('???')).toHaveLength(9)
  })
})
