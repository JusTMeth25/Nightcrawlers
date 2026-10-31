import { describe, expect, it, vi } from 'vitest'
import { EventBus, type GameEvents } from '@shared/events'
import { createInventory } from '../systems/inventory'
import { createRng } from '../systems/rng'
import { bindSceneEnd, SCENE_DESTROY, SCENE_SHUTDOWN } from './lifecycle'
import { PauseState } from './PauseState'
import { RunFlow } from './RunFlow'

/** Minimal stand-in for a Phaser scene's event emitter (once/off/emit). */
function emitter() {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>()
  return {
    once(event: string, fn: (...a: unknown[]) => void) {
      const wrap = (...a: unknown[]) => {
        handlers.get(event)?.delete(wrap)
        fn(...a)
      }
      ;(wrap as { orig?: unknown }).orig = fn
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(wrap)
    },
    off(event: string, fn: (...a: unknown[]) => void) {
      for (const h of handlers.get(event) ?? []) if ((h as { orig?: unknown }).orig === fn) handlers.get(event)!.delete(h)
    },
    emit(event: string) {
      for (const h of [...(handlers.get(event) ?? [])]) h()
    },
  }
}

/** Counts live subscriptions made through bus.on. */
function countingBus() {
  const bus = new EventBus<GameEvents>()
  let live = 0
  const on = bus.on.bind(bus)
  bus.on = ((event, fn) => {
    live++
    const off = on(event, fn)
    let done = false
    return () => {
      if (!done) live--
      done = true
      off()
    }
  }) as typeof bus.on
  return { bus, live: () => live }
}

function session() {
  const { bus, live } = countingBus()
  let flow: RunFlow | null = null
  const pause = new PauseState(bus, () => flow?.busy ?? false)
  flow = new RunFlow(bus, {
    rng: createRng(1),
    getInventory: () => createInventory('pistol'),
    setInventory: () => {},
    luck: () => 1,
    pause: (r) => pause.pause(r),
    resume: (r) => pause.resume(r),
  })
  return { bus, live, teardown: () => (flow!.dispose(), pause.dispose()) }
}

describe('bindSceneEnd', () => {
  it('tears down on destroy (Game.destroy emits no shutdown) and only once', () => {
    const { live, teardown } = session()
    expect(live()).toBe(4)
    const events = emitter()
    const fn = vi.fn(teardown)
    bindSceneEnd(events, fn)
    events.emit(SCENE_DESTROY)
    events.emit(SCENE_SHUTDOWN)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(true)
    expect(live()).toBe(0)
  })

  it('tears down on shutdown and ignores a later destroy', () => {
    const { live, teardown } = session()
    const events = emitter()
    const fn = vi.fn(teardown)
    bindSceneEnd(events, fn)
    events.emit(SCENE_SHUTDOWN)
    events.emit(SCENE_DESTROY)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(false)
    expect(live()).toBe(0)
  })
})
