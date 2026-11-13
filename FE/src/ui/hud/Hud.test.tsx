import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import type { HudState } from '@shared/types'
import { setLocale } from '../i18n/locale'
import { formatTime } from './format'
import { Hud } from './Hud'

const base: HudState = {
  timeSec: 0,
  hp: 80,
  maxHp: 100,
  level: 4,
  xp: 30,
  xpToNext: 60,
  kills: 123,
  eurodollars: 45,
  psychosis: 20,
  psychosisActive: false,
  skillCooldown01: 0,
  weapons: [
    { id: 'pistol', level: 3, evolved: false },
    { id: 'shotgun', level: 8, evolved: true },
  ],
  cyberware: [{ id: 'kerenzikov', level: 2 }],
  bossHp01: null,
  maxtacAlert: false,
  fps: null,
}

function update(patch: Partial<HudState> = {}) {
  act(() => gameBus.emit('hud:update', { ...base, ...patch }))
}

afterEach(() => {
  setLocale('it')
  vi.restoreAllMocks()
})

describe('Hud numbers', () => {
  it('groups kills and €$ thousands in the current locale', () => {
    setLocale('en')
    render(<Hud />)
    update({ kills: 12345, eurodollars: 6789 })
    expect(screen.getByText('12,345')).toBeInTheDocument()
    expect(screen.getByText('6,789')).toBeInTheDocument()
  })
})

describe('formatTime', () => {
  it('uses mm:ss under an hour and h:mm:ss beyond', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(65.7)).toBe('01:05')
    expect(formatTime(3599)).toBe('59:59')
    expect(formatTime(3725)).toBe('1:02:05')
  })
})

describe('Hud', () => {
  it('renders the time as h:mm:ss after an hour', () => {
    render(<Hud />)
    update({ timeSec: 3725 })
    expect(screen.getByText('1:02:05')).toBeInTheDocument()
  })

  it('shows HP, level, kills, eurodollars and inventory with levels', () => {
    render(<Hud />)
    update()
    expect(screen.getByRole('progressbar', { name: 'PV' })).toHaveAttribute('aria-valuenow', '80')
    expect(screen.getByText('Liv. 4')).toBeInTheDocument()
    expect(screen.getByText('123')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('Pistola')).toBeInTheDocument()
    expect(screen.getByText('Shotgun Devastatore')).toBeInTheDocument()
    expect(screen.getByText('Riflessi Kerenzikov')).toBeInTheDocument()
  })

  it('shows no boss bar when bossHp01 is null, and one when it is a number', () => {
    render(<Hud />)
    update({ bossHp01: null })
    expect(screen.queryByRole('progressbar', { name: 'Cyberpsicopatico' })).not.toBeInTheDocument()
    update({ bossHp01: 0.5 })
    expect(screen.getByRole('progressbar', { name: 'Cyberpsicopatico' })).toBeInTheDocument()
  })

  it('shows the MaxTac alert, the cyberpsychosis state and the FPS when present', () => {
    render(<Hud />)
    update()
    expect(screen.queryByText('ALLERTA MAXTAC')).not.toBeInTheDocument()
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument()
    update({ maxtacAlert: true, psychosisActive: true, psychosis: 100, fps: 58 })
    expect(screen.getByText('ALLERTA MAXTAC')).toBeInTheDocument()
    expect(screen.getByText('CYBERPSICOSI')).toBeInTheDocument()
    expect(screen.getByText('58 FPS')).toBeInTheDocument()
  })

  it('shows FPS in a readable status pill colored by performance', () => {
    render(<Hud />)
    update({ fps: 58 })
    const pill = screen.getByRole('status', { name: 'FPS' })
    expect(pill).toHaveTextContent('58 FPS')
    expect(pill).toHaveAttribute('data-level', 'ok')
    update({ fps: 40 })
    expect(screen.getByRole('status', { name: 'FPS' })).toHaveAttribute('data-level', 'warn')
    update({ fps: 22 })
    expect(screen.getByRole('status', { name: 'FPS' })).toHaveAttribute('data-level', 'bad')
  })

  it('the pause button emits the pause command', async () => {
    const onPause = vi.fn()
    const off = gameBus.on('pause', onPause)
    render(<Hud />)
    update()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pausa' }))
    expect(onPause).toHaveBeenCalledTimes(1)
    off()
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(<Hud />)
    unmount()
    expect(() => gameBus.emit('hud:update', base)).not.toThrow()
  })
})
