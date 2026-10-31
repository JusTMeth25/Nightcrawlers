import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import type { LevelUpCard } from '@shared/types'
import { LevelUpModal } from './LevelUpModal'

const cards: LevelUpCard[] = [
  { kind: 'weapon_up', id: 'pistol', level: 3 },
  { kind: 'weapon_new', id: 'shotgun' },
  { kind: 'cyber_new', id: 'kerenzikov' },
]

let choose: ReturnType<typeof vi.fn<(p: { index: number }) => void>>
let off: () => void

function offer(list: LevelUpCard[] = cards) {
  act(() => gameBus.emit('levelup:offer', { cards: list }))
}

beforeEach(() => {
  choose = vi.fn<(p: { index: number }) => void>()
  off = gameBus.on('levelup:choose', choose)
})

afterEach(() => {
  off()
  vi.useRealTimers()
})

describe('LevelUpModal', () => {
  it('is hidden until an offer arrives, then shows one button per card', () => {
    render(<LevelUpModal armDelayMs={0} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    offer()
    expect(screen.getByRole('dialog', { name: 'Level up!' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Pistola/ })).toHaveFocus()
  })

  it('a click on the second card emits levelup:choose {index:1} once, even with a fast double click', async () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    const second = screen.getByRole('button', { name: /Shotgun/ })
    fireEvent.click(second)
    fireEvent.click(second)
    await userEvent.setup().dblClick(second).catch(() => {})
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith({ index: 1 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('key 3 chooses index 2; repeated keys choose once', async () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    const user = userEvent.setup()
    await user.keyboard('3')
    await user.keyboard('1')
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith({ index: 2 })
  })

  it('arrow keys move between cards and Enter confirms', async () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    const user = userEvent.setup()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /Shotgun/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(choose).toHaveBeenCalledWith({ index: 1 })
  })

  it('a held arrow key (repeat events) does not move the focus', () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    expect(screen.getByRole('button', { name: /Pistola/ })).toHaveFocus()
  })

  it('an auto-repeated Enter on the focused card does not choose', () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    expect(fireEvent.keyDown(screen.getByRole('button', { name: /Pistola/ }), { key: 'Enter', repeat: true })).toBe(false)
  })

  it('arrow keys are ignored during the arm delay', () => {
    vi.useFakeTimers()
    render(<LevelUpModal armDelayMs={300} />)
    offer()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: /Pistola/ })).toHaveFocus()
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: /Shotgun/ })).toHaveFocus()
  })

  it('ignores keys that do not match a card', async () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer(cards.slice(0, 2))
    await userEvent.setup().keyboard('4')
    expect(choose).not.toHaveBeenCalled()
  })

  it('opens again on the next offer', () => {
    render(<LevelUpModal armDelayMs={0} />)
    offer()
    fireEvent.click(screen.getByRole('button', { name: /Pistola/ }))
    offer([{ kind: 'heal', amount: 30 }])
    fireEvent.click(screen.getByRole('button', { name: /Kit medico/ }))
    expect(choose).toHaveBeenNthCalledWith(1, { index: 0 })
    expect(choose).toHaveBeenNthCalledWith(2, { index: 0 })
  })

  it('ignores input during the arm delay right after opening', () => {
    vi.useFakeTimers()
    render(<LevelUpModal armDelayMs={300} />)
    offer()
    fireEvent.click(screen.getByRole('button', { name: /Pistola/ }))
    expect(choose).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.click(screen.getByRole('button', { name: /Pistola/ }))
    expect(choose).toHaveBeenCalledTimes(1)
  })

  describe('with a gamepad', () => {
    const buttons = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }))
    let pad: { index: number; connected: boolean; mapping: string; axes: number[]; buttons: ReturnType<typeof buttons> }
    const press = (i: number, pressed = true) => {
      pad.buttons[i] = { pressed, value: pressed ? 1 : 0, touched: pressed }
    }
    const frames = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms)
      })

    beforeEach(() => {
      vi.useFakeTimers()
      pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: buttons() }
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] })
    })

    it('D-pad changes card, A confirms once even with repeated presses', () => {
      render(<LevelUpModal armDelayMs={0} />)
      offer()
      frames(50)
      press(15)
      frames(32)
      press(15, false)
      expect(screen.getByRole('button', { name: /Shotgun/ })).toHaveFocus()
      press(0)
      frames(32)
      press(0, false)
      frames(32)
      press(0)
      frames(32)
      expect(choose).toHaveBeenCalledTimes(1)
      expect(choose).toHaveBeenCalledWith({ index: 1 })
    })

    it('a stick held from gameplay across the offer keeps the focus on card 1', () => {
      render(<LevelUpModal armDelayMs={0} />)
      frames(50)
      pad.axes[0] = 0.9
      frames(50)
      offer()
      frames(1000)
      expect(screen.getByRole('button', { name: /Pistola/ })).toHaveFocus()
      expect(choose).not.toHaveBeenCalled()
    })

    it('an A already held when the offer appears does not choose', () => {
      render(<LevelUpModal armDelayMs={0} />)
      press(0)
      offer()
      frames(500)
      expect(choose).not.toHaveBeenCalled()
    })
  })
})
