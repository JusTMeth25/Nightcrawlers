import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import App from './App'
import { bindLocaleToOptions, setLocale } from './ui/i18n/locale'
import { useOptions } from './ui/store/options'
import { useSession } from './ui/store/session'

// real title and options screens; /play stands in for PlayScreen (Phaser) and counts its mounts
const playMounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('./ui/routes', async () => {
  // no JSX here: the factory is hoisted above the JSX runtime import
  const { createElement: h, Fragment, useEffect } = await import('react')
  const { Link } = await import('react-router')
  const { default: TitleScreen } = await import('./ui/screens/TitleScreen')
  const { default: OptionsScreen } = await import('./ui/screens/OptionsScreen')
  const { PauseMenu } = await import('./ui/hud/PauseMenu')
  function FakePlay() {
    useEffect(() => {
      playMounts.count++
    }, [])
    return h(PauseMenu)
  }
  return {
    routes: [
      { path: '/', element: h(Fragment, null, h(TitleScreen), h(Link, { to: '/play' }, 'fake play')) },
      { path: '/options', element: h(OptionsScreen) },
      { path: '/play', element: h(FakePlay) },
    ],
  }
})

const initial = useSession.getState()
let unbind: (() => void) | null = null

afterEach(() => {
  unbind?.()
  unbind = null
  useOptions.getState().set({ locale: 'it', autoAim: false })
  setLocale('it')
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

describe('App language', () => {
  it('choosing English in Options re-renders every screen in English', async () => {
    useOptions.getState().set({ locale: 'it' })
    unbind = bindLocaleToOptions(useOptions)
    useSession.setState({ status: 'guest', updateLocale: vi.fn(async () => {}) })
    render(<App />)
    const u = userEvent.setup()
    await u.click(screen.getByRole('link', { name: 'Opzioni' }))
    await u.selectOptions(screen.getByRole('combobox', { name: 'Lingua' }), 'en')
    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveValue('en')
    expect(document.documentElement.lang).toBe('en')
    await u.click(screen.getByRole('link', { name: 'Back' }))
    expect(screen.getByRole('link', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('Survive the Night City night')).toBeInTheDocument()
  })

  // review focus 5: the language cannot change mid-run, so the play screen is never remounted
  it('the pause menu options never remount the play screen', async () => {
    useOptions.getState().set({ locale: 'it' })
    unbind = bindLocaleToOptions(useOptions)
    useSession.setState({ status: 'guest' })
    render(<App />)
    const u = userEvent.setup()
    if (!screen.queryByRole('link', { name: 'fake play' })) await u.click(screen.getByRole('link', { name: /Back|Indietro/ }))
    await u.click(screen.getByRole('link', { name: 'fake play' }))
    const mounts = playMounts.count
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    await u.click(screen.getByRole('button', { name: 'Opzioni' }))
    expect(screen.getByRole('combobox', { name: 'Lingua' })).toBeDisabled()
    await u.click(screen.getByRole('checkbox', { name: /Mira automatica/ }))
    expect(useOptions.getState().options.autoAim).toBe(true)
    expect(playMounts.count).toBe(mounts)
    expect(screen.getByRole('dialog', { name: 'Pausa' })).toBeInTheDocument()
  })
})

