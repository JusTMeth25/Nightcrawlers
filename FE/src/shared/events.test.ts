import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from './events'

interface TestEvents {
  ping: { n: number }
  done: undefined
}

describe('EventBus', () => {
  afterEach(() => vi.restoreAllMocks())

  it('delivers the payload to subscribers', () => {
    const bus = new EventBus<TestEvents>()
    const fn = vi.fn()
    bus.on('ping', fn)
    bus.emit('ping', { n: 1 })
    expect(fn).toHaveBeenCalledWith({ n: 1 })
  })

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<TestEvents>()
    const fn = vi.fn()
    const off = bus.on('ping', fn)
    off()
    bus.emit('ping', { n: 1 })
    expect(fn).not.toHaveBeenCalled()
  })

  it('keeps delivering when a listener throws', () => {
    const bus = new EventBus<TestEvents>()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const after = vi.fn()
    bus.on('ping', () => {
      throw new Error('boom')
    })
    bus.on('ping', after)
    bus.emit('ping', { n: 2 })
    expect(after).toHaveBeenCalledWith({ n: 2 })
    expect(error).toHaveBeenCalled()
  })

  it('clear removes every listener', () => {
    const bus = new EventBus<TestEvents>()
    const fn = vi.fn()
    bus.on('ping', fn)
    bus.on('done', fn)
    bus.clear()
    bus.emit('ping', { n: 1 })
    bus.emit('done', undefined)
    expect(fn).not.toHaveBeenCalled()
  })

  it('a listener unsubscribing during emit does not skip others', () => {
    const bus = new EventBus<TestEvents>()
    const second = vi.fn()
    const off = bus.on('ping', () => off())
    bus.on('ping', second)
    bus.emit('ping', { n: 3 })
    expect(second).toHaveBeenCalledTimes(1)
  })
})
