import { describe, expect, it } from 'vitest'
import { EventBus, type GameEvents } from '@shared/events'
import type { HudState } from '@shared/types'
import { HudReporter } from './HudReporter'

const state = (timeSec: number): HudState => ({
  timeSec,
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  xpToNext: 5,
  kills: 0,
  eurodollars: 0,
  psychosis: 0,
  psychosisActive: false,
  skillCooldown01: 0,
  weapons: [],
  cyberware: [],
  bossHp01: null,
  maxtacAlert: false,
  fps: null,
})

describe('HudReporter', () => {
  it('emits at most once every 100 ms', () => {
    const bus = new EventBus<GameEvents>()
    const seen: number[] = []
    bus.on('hud:update', (s) => seen.push(s.timeSec))
    const hud = new HudReporter(bus)
    hud.maybeEmit(0, state(0))
    hud.maybeEmit(50, state(1))
    hud.maybeEmit(120, state(2))
    expect(seen).toEqual([0, 2])
  })

  it('tells when the next emission is due, so the state is built only then', () => {
    const hud = new HudReporter(new EventBus<GameEvents>())
    expect(hud.due(0)).toBe(true)
    hud.maybeEmit(0, state(0))
    expect(hud.due(99)).toBe(false)
    expect(hud.due(100)).toBe(true)
  })
})
