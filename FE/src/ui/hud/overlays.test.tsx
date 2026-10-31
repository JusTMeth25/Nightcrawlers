import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWeapon } from '@data/index'
import { gameBus, type GameEvents } from '@shared/events'
import { ChestModal } from './ChestModal'
import { PauseMenu } from './PauseMenu'

const offs: (() => void)[] = []
function listen<K extends keyof GameEvents>(event: K) {
  const fn = vi.fn()
  offs.push(gameBus.on(event, fn))
  return fn
}

afterEach(() => {
  while (offs.length) offs.pop()!()
})

describe('ChestModal', () => {
  it('shows the evolution and "Continua" emits chest:close once', async () => {
    const close = listen('chest:close')
    render(<ChestModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => gameBus.emit('chest:open', { cards: [], evolution: { weapon: 'pistol', into: 'Pistola Overclock' } }))
    expect(screen.getByRole('dialog', { name: 'Baule aperto' })).toBeInTheDocument()
    expect(screen.getByText('Pistola si evolve in Pistola Overclock')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Continua' }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('maps an evolution id to its name', () => {
    render(<ChestModal />)
    const evo = getWeapon('shotgun').evolution
    act(() => gameBus.emit('chest:open', { cards: [], evolution: { weapon: 'shotgun', into: evo.id } }))
    expect(screen.getByText(`Shotgun si evolve in ${evo.name}`)).toBeInTheDocument()
  })

  it('lists the reward cards', () => {
    render(<ChestModal />)
    act(() =>
      gameBus.emit('chest:open', {
        cards: [
          { kind: 'weapon_up', id: 'pistol', level: 4 },
          { kind: 'heal', amount: 30 },
        ],
        evolution: null,
      }),
    )
    expect(screen.getByText('Pistola')).toBeInTheDocument()
    expect(screen.getByText('Livello 4')).toBeInTheDocument()
    expect(screen.getByText('Kit medico')).toBeInTheDocument()
    expect(screen.queryByText(/si evolve/)).not.toBeInTheDocument()
  })
})

describe('PauseMenu', () => {
  beforeEach(() => {
    render(<PauseMenu />)
  })

  it('opens on game:paused {reason:"menu"} only', () => {
    act(() => gameBus.emit('game:paused', { reason: 'levelup' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => gameBus.emit('game:paused', { reason: 'chest' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    expect(screen.getByRole('dialog', { name: 'Pausa' })).toBeInTheDocument()
  })

  it('"Riprendi" emits resume and the menu closes on game:resumed', async () => {
    const resume = listen('resume')
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Riprendi' }))
    expect(resume).toHaveBeenCalledTimes(1)
    act(() => gameBus.emit('game:resumed', undefined))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Abbandona" asks for confirmation and then emits run:quit', async () => {
    const quit = listen('run:quit')
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abbandona' }))
    expect(quit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sì, abbandona' }))
    expect(quit).toHaveBeenCalledTimes(1)
  })

  it('cancelling the confirmation goes back without quitting', async () => {
    const quit = listen('run:quit')
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abbandona' }))
    await user.click(screen.getByRole('button', { name: 'No, continua' }))
    expect(quit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Riprendi' })).toBeInTheDocument()
  })

  it('"Opzioni" opens the options overlay', async () => {
    act(() => gameBus.emit('game:paused', { reason: 'menu' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Opzioni' }))
    expect(screen.getByRole('heading', { name: 'Opzioni' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Riprendi' })).toBeInTheDocument()
  })
})
