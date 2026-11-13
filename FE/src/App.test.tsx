import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { api } from './api'
import { DEMO_LOGIN, DEMO_PASSWORD } from './api/mock/MockApi'
import App from './App'
import { bindLocaleToOptions, getLocale, setLocale } from './ui/i18n/locale'
import { useOptions } from './ui/store/options'
import { useSession } from './ui/store/session'

vi.mock('./api', async () => {
  const { createAuthBridge } = await import('./api/auth')
  const { MockApi } = await import('./api/mock/MockApi')
  const errors = await import('./api/errors')
  const authBridge = createAuthBridge()
  return {
    authBridge,
    api: new MockApi({ auth: authBridge, latencyMs: 0, log: () => {} }),
    isMockApi: true,
    ApiError: errors.ApiError,
    isApiError: errors.isApiError,
  }
})

// real title and options screens; /play stands in for PlayScreen (Phaser) and counts its mounts
const playMounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('./ui/routes', async () => {
  // no JSX here: the factory is hoisted above the JSX runtime import
  const { createElement: h, useEffect } = await import('react')
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
      { path: '/', element: h(TitleScreen) },
      { path: '/options', element: h(OptionsScreen) },
      { path: '/play', element: h(FakePlay) },
    ],
  }
})

const initial = useSession.getState()
let unbind: (() => void) | null = null

/** The browser router lives as long as the module: every test states where it starts. */
function startAt(path: string) {
  act(() => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
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
    startAt('/')
    render(<App />)
    const u = userEvent.setup()
    await u.click(screen.getByRole('link', { name: 'Opzioni' }))
    await u.selectOptions(screen.getByRole('combobox', { name: 'Lingua' }), 'en')
    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveValue('en')
    // the remount keeps the focus on the language control, so keyboard and gamepad can keep going
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveFocus()
    expect(document.documentElement.lang).toBe('en')
    await u.click(screen.getByRole('link', { name: 'Back' }))
    expect(screen.getByRole('link', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('Survive the night in Night City')).toBeInTheDocument()
  })

  // review focus 5: the language cannot change mid-run, so the play screen is never remounted
  it('the pause menu options never remount the play screen', async () => {
    useOptions.getState().set({ locale: 'it' })
    unbind = bindLocaleToOptions(useOptions)
    useSession.setState({ status: 'guest' })
    startAt('/play')
    render(<App />)
    const u = userEvent.setup()
    const mounts = playMounts.count
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    await u.click(screen.getByRole('button', { name: 'Opzioni' }))
    expect(screen.getByRole('combobox', { name: 'Lingua' })).toBeDisabled()
    await u.click(screen.getByRole('checkbox', { name: /Mira automatica/ }))
    expect(useOptions.getState().options.autoAim).toBe(true)
    expect(playMounts.count).toBe(mounts)
    expect(screen.getByRole('dialog', { name: 'Pausa' })).toBeInTheDocument()
  })

  // review focus 2: a second device with an English browser keeps English after logging in
  // to an account whose language is Italian, and the account is not changed
  it('login with an Italian account keeps the device in English', async () => {
    useOptions.getState().set({ locale: 'en' })
    unbind = bindLocaleToOptions(useOptions)
    const update = vi.spyOn(api, 'updateLocale')
    useSession.setState({ status: 'guest' })
    startAt('/')
    render(<App />)
    expect(screen.getByRole('link', { name: 'Play' })).toBeInTheDocument()
    await act(() => useSession.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD }))
    expect(useSession.getState().user?.locale).toBe('it')
    expect(useOptions.getState().options.locale).toBe('en')
    expect(getLocale()).toBe('en')
    expect(screen.getByText('Logged in as demo')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
