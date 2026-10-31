import { useCallback, useEffect, useRef } from 'react'
import { adjustRange, moveFocus, type NavDirection } from './focus'

export const REPEAT_DELAY_MS = 250
export const REPEAT_INTERVAL_MS = 150
const STICK_THRESHOLD = 0.5
const BUTTON_A = 0
const BUTTON_B = 1
const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const

interface PadSnapshot {
  direction: NavDirection | null
  a: boolean
  b: boolean
}

// Only the most recently mounted navigable container reacts (a modal over a screen wins).
const activeStack: symbol[] = []

function pressed(pad: Gamepad, index: number) {
  return pad.buttons[index]?.pressed ?? false
}

function readPads(): PadSnapshot | null {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
  let found = false
  const snap: PadSnapshot = { direction: null, a: false, b: false }
  for (const pad of pads) {
    if (!pad || !pad.connected) continue
    found = true
    const x = pad.axes[0] ?? 0
    const y = pad.axes[1] ?? 0
    snap.direction ??=
      pressed(pad, DPAD.up) || y < -STICK_THRESHOLD
        ? 'up'
        : pressed(pad, DPAD.down) || y > STICK_THRESHOLD
          ? 'down'
          : pressed(pad, DPAD.left) || x < -STICK_THRESHOLD
            ? 'left'
            : pressed(pad, DPAD.right) || x > STICK_THRESHOLD
              ? 'right'
              : null
    snap.a ||= pressed(pad, BUTTON_A)
    snap.b ||= pressed(pad, BUTTON_B)
  }
  return found ? snap : null
}

/**
 * Gamepad navigation for React menus: stick/D-pad move the focus between [data-nav] elements
 * of the returned container (DOM order, repeat after 250 ms), A clicks the focused element,
 * B calls onBack. One action per press: buttons already held when the menu appears are ignored.
 */
export function useGamepadNav(opts: { onBack?: () => void; enabled?: boolean } = {}) {
  const containerRef = useRef<HTMLElement | null>(null)
  const onBackRef = useRef(opts.onBack)
  const enabled = opts.enabled ?? true

  useEffect(() => {
    onBackRef.current = opts.onBack
  })

  useEffect(() => {
    if (!enabled) return
    const id = Symbol('gamepad-nav')
    activeStack.push(id)
    let frame = 0
    let prev: PadSnapshot | null = null
    let repeatAt = 0
    let blocked: NavDirection | null = null

    const container = () => containerRef.current ?? document.body

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop)
      const now = Number.isFinite(time) ? time : performance.now()
      const snap = activeStack[activeStack.length - 1] === id ? readPads() : null
      if (!snap) {
        prev = null
        return
      }
      if (!prev) {
        // first frame as active menu: remember what is already held, act on nothing.
        // A direction held from gameplay stays ignored until it returns to neutral or changes.
        blocked = snap.direction
        prev = { ...snap, direction: null }
        return
      }
      let dir = snap.direction
      if (blocked) {
        if (dir === blocked) dir = null
        else blocked = null
      }
      snap.direction = dir
      if (dir && dir !== prev.direction) {
        step(dir)
        repeatAt = now + REPEAT_DELAY_MS
      } else if (dir && now >= repeatAt) {
        step(dir)
        repeatAt = now + REPEAT_INTERVAL_MS
      }
      if (snap.a && !prev.a) {
        const active = document.activeElement
        if (active instanceof HTMLElement && container().contains(active) && active.hasAttribute('data-nav')) {
          active.click()
        }
      }
      if (snap.b && !prev.b) onBackRef.current?.()
      prev = snap
    }

    const step = (dir: NavDirection) => {
      if (adjustRange(document.activeElement, dir)) return
      moveFocus(container(), dir)
    }

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      const at = activeStack.indexOf(id)
      if (at >= 0) activeStack.splice(at, 1)
    }
  }, [enabled])

  return useCallback((el: HTMLElement | null) => {
    containerRef.current = el
  }, [])
}
