import { describe, expect, it, vi } from 'vitest'
import { EventBus, type GameEvents } from '@shared/events'
import type { ChestReward, LevelUpCard } from '@shared/types'
import { createInventory, type Inventory } from '../systems/inventory'
import { createRng } from '../systems/rng'
import { RunFlow } from './RunFlow'

function setup(inventory: Inventory = createInventory('pistol')) {
  const bus = new EventBus<GameEvents>()
  let inv = inventory
  const deps = {
    rng: createRng(5),
    getInventory: () => inv,
    setInventory: vi.fn((next: Inventory) => {
      inv = next
    }),
    luck: () => 1,
    pause: vi.fn(),
    resume: vi.fn(),
    onCard: vi.fn(),
  }
  const offers: LevelUpCard[][] = []
  const chests: ChestReward[] = []
  bus.on('levelup:offer', (p) => offers.push(p.cards))
  bus.on('chest:open', (p) => chests.push(p))
  const flow = new RunFlow(bus, deps)
  return { bus, deps, flow, offers, chests, inv: () => inv }
}

describe('RunFlow level-ups', () => {
  it('queues several level-ups and offers them one at a time', () => {
    const { bus, deps, flow, offers } = setup()
    flow.onLevels(2)
    expect(offers).toHaveLength(1)
    expect(deps.pause).toHaveBeenCalledTimes(1)
    expect(deps.pause).toHaveBeenCalledWith('levelup')
    bus.emit('levelup:choose', { index: 0 })
    expect(offers).toHaveLength(2)
    expect(deps.resume).not.toHaveBeenCalled()
    bus.emit('levelup:choose', { index: 0 })
    expect(offers).toHaveLength(2)
    expect(deps.resume).toHaveBeenCalledTimes(1)
    expect(deps.setInventory).toHaveBeenCalledTimes(2)
  })

  it('applies the chosen card', () => {
    const { bus, deps, flow, offers, inv } = setup()
    flow.onLevels(1)
    const card = offers[0][1]
    bus.emit('levelup:choose', { index: 1 })
    expect(deps.onCard).toHaveBeenCalledWith(card)
    if (card.kind === 'weapon_new') expect(inv().weapons.map((w) => w.id)).toContain(card.id)
  })

  it('ignores an out-of-range index and stray chooses', () => {
    const { bus, deps, flow, offers } = setup()
    bus.emit('levelup:choose', { index: 0 })
    expect(deps.setInventory).not.toHaveBeenCalled()
    flow.onLevels(1)
    bus.emit('levelup:choose', { index: 9 })
    bus.emit('levelup:choose', { index: -1 })
    expect(deps.setInventory).not.toHaveBeenCalled()
    expect(deps.resume).not.toHaveBeenCalled()
    expect(offers).toHaveLength(1)
  })
})

describe('RunFlow chests', () => {
  const ready: Inventory = { weapons: [{ id: 'pistol', level: 8, evolved: false }], cyberware: [{ id: 'kerenzikov', level: 1 }] }

  it('opens a chest with the evolution and applies it on close', () => {
    const { bus, deps, flow, chests, inv } = setup(ready)
    flow.onChestOpened()
    expect(deps.pause).toHaveBeenCalledWith('chest')
    expect(chests[0].evolution).toEqual({ weapon: 'pistol', into: 'pistol_evo' })
    bus.emit('chest:close', undefined)
    expect(inv().weapons[0].evolved).toBe(true)
    expect(deps.resume).toHaveBeenCalledWith('chest')
  })

  it('waits for pending level-ups before opening the chest', () => {
    const { bus, deps, flow, offers, chests } = setup()
    flow.onLevels(1)
    flow.onChestOpened()
    expect(chests).toHaveLength(0)
    bus.emit('levelup:choose', { index: 0 })
    expect(chests).toHaveLength(1)
    expect(deps.resume).toHaveBeenCalledWith('levelup')
    expect(deps.pause).toHaveBeenLastCalledWith('chest')
    flow.onLevels(1)
    expect(offers).toHaveLength(1)
    bus.emit('chest:close', undefined)
    expect(offers).toHaveLength(2)
  })

  it('pauses for the chest before releasing the level-up pause (no resume between modals)', () => {
    const { bus, deps, flow } = setup()
    flow.onLevels(1)
    flow.onChestOpened()
    bus.emit('levelup:choose', { index: 0 })
    const pauseChest = deps.pause.mock.invocationCallOrder[deps.pause.mock.calls.findIndex((c) => c[0] === 'chest')]
    const resumeLevel = deps.resume.mock.invocationCallOrder[deps.resume.mock.calls.findIndex((c) => c[0] === 'levelup')]
    expect(pauseChest).toBeLessThan(resumeLevel)
  })

  it('removes its listeners on dispose', () => {
    const { bus, deps, flow } = setup(ready)
    flow.onChestOpened()
    flow.dispose()
    bus.emit('chest:close', undefined)
    bus.emit('levelup:choose', { index: 0 })
    expect(deps.setInventory).not.toHaveBeenCalled()
  })
})
