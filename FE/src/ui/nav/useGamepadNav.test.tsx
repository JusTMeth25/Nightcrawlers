import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OptionsPanel } from '../components/OptionsPanel'
import { useOptions } from '../store/options'
import { useGamepadNav } from './useGamepadNav'

interface FakePad {
  index: number
  connected: boolean
  mapping: string
  axes: number[]
  buttons: { pressed: boolean; value: number; touched: boolean }[]
}

let pad: FakePad

function press(button: number, pressed = true) {
  pad.buttons[button] = { pressed, value: pressed ? 1 : 0, touched: pressed }
}

function frames(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function Menu({ onBack, onTwo, label = 'menu' }: { onBack?: () => void; onTwo?: () => void; label?: string }) {
  const ref = useGamepadNav({ onBack })
  return (
    <div ref={ref} aria-label={label}>
      <button data-nav>Uno</button>
      <button data-nav onClick={onTwo}>
        Due
      </button>
      <button data-nav>Tre</button>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  pad = {
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
  }
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useGamepadNav', () => {
  it('D-pad down moves the focus from the first to the second [data-nav] element', () => {
    render(<Menu />)
    screen.getByText('Uno').focus()
    frames(50)
    press(13)
    frames(32)
    expect(screen.getByText('Due')).toHaveFocus()
  })

  it('holding the D-pad does not skip more than one element before 250 ms, then repeats', () => {
    render(<Menu />)
    screen.getByText('Uno').focus()
    frames(50)
    press(13)
    frames(200)
    expect(screen.getByText('Due')).toHaveFocus()
    frames(120)
    expect(screen.getByText('Tre')).toHaveFocus()
  })

  it('the left stick moves the focus too, and up goes back', () => {
    render(<Menu />)
    screen.getByText('Due').focus()
    frames(50)
    pad.axes[1] = -0.9
    frames(32)
    expect(screen.getByText('Uno')).toHaveFocus()
  })

  it('focuses the first element when nothing in the container has focus', () => {
    render(<Menu />)
    frames(50)
    press(13)
    frames(32)
    expect(screen.getByText('Uno')).toHaveFocus()
  })

  it('A clicks the focused element once per press', () => {
    const onTwo = vi.fn()
    render(<Menu onTwo={onTwo} />)
    screen.getByText('Due').focus()
    frames(50)
    press(0)
    frames(500)
    expect(onTwo).toHaveBeenCalledTimes(1)
    press(0, false)
    frames(32)
    press(0)
    frames(32)
    expect(onTwo).toHaveBeenCalledTimes(2)
  })

  it('an A already held when the menu appears does not click', () => {
    const onTwo = vi.fn()
    press(0)
    render(<Menu onTwo={onTwo} />)
    screen.getByText('Due').focus()
    frames(200)
    expect(onTwo).not.toHaveBeenCalled()
  })

  it('a direction already held when the menu appears is ignored until released', () => {
    pad.axes[0] = 0.9
    render(<Menu />)
    screen.getByText('Uno').focus()
    frames(1000)
    expect(screen.getByText('Uno')).toHaveFocus()
    pad.axes[0] = 0
    frames(32)
    pad.axes[0] = 0.9
    frames(32)
    expect(screen.getByText('Due')).toHaveFocus()
  })

  it('B calls onBack', () => {
    const onBack = vi.fn()
    render(<Menu onBack={onBack} />)
    frames(50)
    press(1)
    frames(100)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('only the most recently mounted container reacts', () => {
    const backA = vi.fn()
    const backB = vi.fn()
    render(
      <>
        <Menu onBack={backA} label="a" />
        <Menu onBack={backB} label="b" />
      </>,
    )
    frames(50)
    press(1)
    frames(50)
    expect(backB).toHaveBeenCalledTimes(1)
    expect(backA).not.toHaveBeenCalled()
  })

  it('left/right on the focused language selector cycle the locale', () => {
    useOptions.getState().set({ locale: 'it' })
    function Options() {
      const ref = useGamepadNav()
      return (
        <div ref={ref}>
          <OptionsPanel />
        </div>
      )
    }
    render(<Options />)
    const select = screen.getByRole('combobox', { name: 'Lingua' })
    select.focus()
    frames(50)
    press(15)
    frames(32)
    expect(useOptions.getState().options.locale).toBe('en')
    press(15, false)
    frames(32)
    press(14)
    frames(32)
    press(14, false)
    frames(32)
    press(14)
    frames(32)
    expect(useOptions.getState().options.locale).toBe('es')
    expect(select).toHaveFocus()
    useOptions.getState().set({ locale: 'it' })
  })
})
