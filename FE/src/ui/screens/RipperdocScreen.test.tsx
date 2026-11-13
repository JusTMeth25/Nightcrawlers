import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRipperdoc, ripperdocCost } from '@data'
import { api } from '../../api'
import { problemError } from '../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD } from '../../api/mock/MockApi'
import { setLocale } from '../i18n/locale'
import { useSession } from '../store/session'
import RipperdocScreen from './RipperdocScreen'

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

function renderRipperdoc() {
  const router = createMemoryRouter(
    [
      { path: '/ripperdoc', element: <RipperdocScreen /> },
      { path: '/register', element: <p>register</p> },
    ],
    { initialEntries: ['/ripperdoc'] },
  )
  render(<RouterProvider router={router} />)
}

function row(name: string) {
  return screen.getByRole('listitem', { name })
}

async function loginDemo(eurodollars: number) {
  await useSession.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
  const save = useSession.getState().save!
  useSession.setState({ save: { ...save, eurodollars } })
}

afterEach(async () => {
  setLocale('it')
  vi.restoreAllMocks()
  await useSession.getState().logout()
})

describe('RipperdocScreen', () => {
  it('shows rank, effect and cost of every upgrade', async () => {
    await loginDemo(2500)
    renderRipperdoc()
    const might = getRipperdoc('might')
    const r = row(might.name)
    expect(within(r).getByText('Grado 2 / 5')).toBeInTheDocument()
    expect(within(r).getByText('+5% potenza per grado')).toBeInTheDocument()
    expect(within(r).getByRole('button', { name: `Installa ${might.name} per ${ripperdocCost(might, 2)} €$` })).toBeEnabled()
  })

  it('shows names and effects in English', async () => {
    setLocale('en')
    await loginDemo(2500)
    renderRipperdoc()
    const r = row('Muscle Booster')
    expect(within(r).getByText('Rank 2 / 5')).toBeInTheDocument()
    expect(within(r).getByText('+5% might per rank')).toBeInTheDocument()
    expect(within(r).getByRole('button', { name: /^Install Muscle Booster for \d+ €\$$/ })).toBeEnabled()
  })

  it('formats balance and costs in Spanish', async () => {
    setLocale('es')
    await loginDemo(12500)
    renderRipperdoc()
    expect(screen.getByText('Saldo: 12.500 €$')).toBeInTheDocument()
    const r = row('Potenciador muscular')
    expect(within(r).getByText('Rango 2 / 5')).toBeInTheDocument()
    const cost = ripperdocCost(getRipperdoc('might'), 2)
    expect(within(r).getByRole('button', { name: `Instalar Potenciador muscular por ${cost.toLocaleString('es', { useGrouping: 'always' })} €$` })).toBeEnabled()
  })

  it('disables the purchase when the €$ are not enough', async () => {
    await loginDemo(10)
    renderRipperdoc()
    const def = getRipperdoc('armor')
    expect(within(row(def.name)).getByRole('button', { name: /Installa/ })).toBeDisabled()
  })

  it('buys a rank and updates the €$', async () => {
    await loginDemo(2500)
    const buy = vi.spyOn(api, 'buyRipperdoc')
    renderRipperdoc()
    const def = getRipperdoc('armor')
    const cost = ripperdocCost(def, 0)
    await userEvent.setup().click(within(row(def.name)).getByRole('button', { name: /Installa/ }))
    expect(buy).toHaveBeenCalledWith('armor')
    expect(await screen.findByText(`Saldo: ${(2500 - cost).toLocaleString('it', { useGrouping: 'always' })} €$`)).toBeInTheDocument()
    expect(within(row(def.name)).getByText('Grado 1 / 3')).toBeInTheDocument()
    expect(useSession.getState().save?.ripperdoc.armor).toBe(1)
  })

  it('shows the problem title of a 409', async () => {
    await loginDemo(2500)
    vi.spyOn(api, 'buyRipperdoc').mockRejectedValueOnce(problemError(409, '€$ insufficienti'))
    const reloadSave = vi.spyOn(useSession.getState(), 'reloadSave')
    renderRipperdoc()
    await userEvent.setup().click(within(row(getRipperdoc('luck').name)).getByRole('button', { name: /Installa/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('€$ insufficienti')
    // the local save was stale: reload it from the server
    expect(reloadSave).toHaveBeenCalledTimes(1)
  })

  it('a maxed upgrade cannot be bought', async () => {
    await loginDemo(99999)
    const save = useSession.getState().save!
    useSession.setState({ save: { ...save, ripperdoc: { revival: 1 } } })
    renderRipperdoc()
    const r = row(getRipperdoc('revival').name)
    expect(within(r).getByRole('button', { name: 'Grado massimo' })).toBeDisabled()
  })

  it('guests see the shop disabled with an invite to register', () => {
    useSession.setState({ status: 'guest' })
    renderRipperdoc()
    expect(screen.getByText(/riservato agli utenti registrati/)).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: /Installa/ })) expect(button).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Registrati per salvare le run' })).toBeInTheDocument()
  })
})
