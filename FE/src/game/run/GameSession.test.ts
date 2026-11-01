import { describe, expect, it, vi } from 'vitest'
import { EventBus, type GameEvents } from '@shared/events'
import { DEFAULT_OPTIONS, type RunConfig } from '@shared/types'
import { createInventory } from '../systems/inventory'
import { createRng } from '../systems/rng'
import { GameSession } from './GameSession'
import { RunFlow } from './RunFlow'

const config: RunConfig = { mode: 'guest', runId: null, seed: 1, characterId: 'david', ripperdoc: {}, options: DEFAULT_OPTIONS }

function flowOn(bus: EventBus<GameEvents>, session: GameSession) {
  let inv = createInventory('pistol')
  return new RunFlow(bus, {
    rng: createRng(1),
    getInventory: () => inv,
    setInventory: (i) => {
      inv = i
    },
    luck: () => 1,
    pause: (r) => session.pause.pause(r),
    resume: (r) => session.pause.resume(r),
  })
}

describe('GameSession', () => {
  it('runs the scene disposers synchronously on dispose: no modal answers reach the old run', () => {
    const bus = new EventBus<GameEvents>()
    const session = new GameSession(bus, config)
    const flow = flowOn(bus, session)
    session.onDispose(() => flow.dispose())
    const offers = vi.fn()
    const chests = vi.fn()
    bus.on('levelup:offer', offers)
    bus.on('chest:open', chests)
    flow.onLevels(2)
    flow.onChestOpened()
    expect(offers).toHaveBeenCalledTimes(1)
    // unmount: Phaser destroys the scene only on the next frame
    session.dispose()
    bus.emit('levelup:choose', { index: 0 })
    bus.emit('chest:close', undefined)
    expect(offers).toHaveBeenCalledTimes(1)
    expect(chests).not.toHaveBeenCalled()
  })

  it('runs a disposer registered after dispose at once', () => {
    const session = new GameSession(new EventBus<GameEvents>(), config)
    session.dispose()
    const fn = vi.fn()
    session.onDispose(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignores the menu pause once the run is over or the player is dead', () => {
    const bus = new EventBus<GameEvents>()
    const session = new GameSession(bus, config)
    let dead = false
    session.link({ modalOpen: () => false, playerDead: () => dead, result: () => ({ ...session.emptyResult() }), applyOptions: () => {} })
    const paused = vi.fn()
    bus.on('game:paused', paused)
    dead = true
    bus.emit('pause', undefined)
    expect(paused).not.toHaveBeenCalled()
    dead = false
    session.end(session.emptyResult())
    bus.emit('pause', undefined)
    expect(paused).not.toHaveBeenCalled()
  })
})
