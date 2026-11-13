import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS } from '@shared/types'
import { PauseMenu } from '../hud/PauseMenu'
import { useOptions } from '../store/options'
import { useSession } from '../store/session'
import OptionsScreen from './OptionsScreen'

function renderOptions() {
  const router = createMemoryRouter([{ path: '/options', element: <OptionsScreen /> }], { initialEntries: ['/options'] })
  render(<RouterProvider router={router} />)
}

const initialSession = useSession.getState()

afterEach(() => {
  vi.restoreAllMocks()
  useSession.setState(initialSession, true)
  useOptions.getState().set({ ...DEFAULT_OPTIONS })
  localStorage.clear()
})

describe('OptionsScreen', () => {
  it('toggles auto aim, FPS and screen shake and emits options:changed', async () => {
    const changed = vi.fn()
    const off = gameBus.on('options:changed', changed)
    renderOptions()
    const u = userEvent.setup()
    await u.click(screen.getByRole('checkbox', { name: /Mira automatica/ }))
    await u.click(screen.getByRole('checkbox', { name: 'Mostra FPS' }))
    await u.click(screen.getByRole('checkbox', { name: 'Scuotimento schermo' }))
    off()
    expect(useOptions.getState().options).toMatchObject({ autoAim: true, showFps: true, screenShake: false })
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it('offers the three languages by their own name', () => {
    renderOptions()
    const select = screen.getByRole('combobox', { name: 'Lingua' })
    expect(select).toBeEnabled()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Italiano', 'English', 'Español'])
  })

  it('a guest changes the language on this device only', async () => {
    const updateLocale = vi.fn(async () => {})
    useSession.setState({ status: 'guest', updateLocale })
    renderOptions()
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Lingua' }), 'en')
    expect(useOptions.getState().options.locale).toBe('en')
    expect(updateLocale).toHaveBeenCalledTimes(1)
    expect(updateLocale).toHaveBeenCalledWith('en')
  })

  it('changes the volumes with sliders from 0 to 1', () => {
    renderOptions()
    const music = screen.getByRole('slider', { name: 'Volume musica' })
    expect(music).toHaveAttribute('min', '0')
    expect(music).toHaveAttribute('max', '1')
    fireEvent.change(music, { target: { value: '0.25' } })
    expect(useOptions.getState().options.musicVolume).toBe(0.25)
    expect(screen.getByText('25%')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'Volume effetti' }), { target: { value: '0' } })
    expect(useOptions.getState().options.sfxVolume).toBe(0)
  })
})

describe('PauseMenu options', () => {
  it('shows the language selector disabled with a note during a run', async () => {
    const set = vi.spyOn(useOptions.getState(), 'set')
    render(<PauseMenu />)
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Opzioni' }))
    const select = screen.getByRole('combobox', { name: 'Lingua' })
    expect(select).toBeDisabled()
    expect(select).toHaveAccessibleDescription('Cambia lingua dal menu principale')
    fireEvent.change(select, { target: { value: 'en' } })
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }))
  })

  it('"Opzioni" shows the real options panel inside the pause menu', async () => {
    render(<PauseMenu />)
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    const u = userEvent.setup()
    await u.click(screen.getByRole('button', { name: 'Opzioni' }))
    await u.click(screen.getByRole('checkbox', { name: /Mira automatica/ }))
    expect(useOptions.getState().options.autoAim).toBe(true)
    await u.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Riprendi' })).toBeInTheDocument()
  })
})
