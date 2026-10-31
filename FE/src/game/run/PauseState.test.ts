import { describe, expect, it } from 'vitest'
import { EventBus, type GameEvents } from '@shared/events'
import { createInventory } from '../systems/inventory'
import { createRng } from '../systems/rng'
import { PauseState } from './PauseState'
import { RunFlow } from './RunFlow'

function setup() {
  const bus = new EventBus<GameEvents>()
  const events: string[] = []
  bus.on('game:paused', (p) => events.push(`paused:${p.reason}`))
  bus.on('game:resumed', () => events.push('resumed'))
  let flow: RunFlow | null = null
  const pause = new PauseState(bus, () => flow?.busy ?? false)
  let inv = createInventory('pistol')
  flow = new RunFlow(bus, {
    rng: createRng(1),
    getInventory: () => inv,
    setInventory: (i) => {
      inv = i
    },
    luck: () => 1,
    pause: (r) => pause.pause(r),
    resume: (r) => pause.resume(r),
  })
  return { bus, events, pause, flow }
}

describe('PauseState', () => {
  it('emits paused and resumed once per change', () => {
    const { pause, events } = setup()
    pause.pause('menu')
    pause.pause('menu')
    expect(pause.paused).toBe(true)
    pause.resume('menu')
    pause.resume('menu')
    expect(events).toEqual(['paused:menu', 'resumed'])
    expect(pause.paused).toBe(false)
  })

  it('toggles the menu from Esc/Start', () => {
    const { pause, events } = setup()
    pause.toggleMenu()
    pause.toggleMenu()
    expect(events).toEqual(['paused:menu', 'resumed'])
  })

  it('ignores menu pause while a level-up is open', () => {
    const { bus, pause, events, flow } = setup()
    flow.onLevels(1)
    pause.toggleMenu()
    bus.emit('pause', undefined)
    expect(events).toEqual(['paused:levelup'])
    bus.emit('levelup:choose', { index: 0 })
    expect(events).toEqual(['paused:levelup', 'resumed'])
    expect(pause.paused).toBe(false)
  })

  it('answers the pause and resume commands and stops listening on dispose', () => {
    const { bus, pause, events } = setup()
    bus.emit('pause', undefined)
    bus.emit('resume', undefined)
    pause.dispose()
    bus.emit('pause', undefined)
    expect(events).toEqual(['paused:menu', 'resumed'])
  })
})
