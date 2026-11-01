import { describe, expect, it } from 'vitest'
import { CheckpointClock, RunStats } from './RunStats'

describe('RunStats', () => {
  it('counts kills per enemy and lists seen enemies once', () => {
    const s = new RunStats()
    s.addKill('maelstrom')
    s.addKill('maelstrom')
    s.addKill('maelstrom')
    s.addKill('arasaka')
    s.seeEnemy('maelstrom')
    s.seeEnemy('arasaka')
    s.seeEnemy('maelstrom')
    const r = s.result('run-1', 'david', 125.7, 7)
    expect(r.kills).toBe(4)
    expect(r.killsByEnemy).toEqual({ maelstrom: 3, arasaka: 1 })
    expect(r.enemiesSeen.sort()).toEqual(['arasaka', 'maelstrom'])
    expect(r).toMatchObject({ runId: 'run-1', characterId: 'david', durationSec: 125, level: 7 })
  })

  it('a killed enemy is also a seen one', () => {
    const s = new RunStats()
    s.addKill('maxtac')
    expect(s.result(null, 'lucy', 1, 1).enemiesSeen).toEqual(['maxtac'])
  })

  it('sums eurodollars and weapons seen in checkpoints and results', () => {
    const s = new RunStats()
    s.addEurodollars(25)
    s.addEurodollars(10)
    s.seeWeapon('pistol')
    s.seeWeapon('pistol')
    s.seeWeapon('drone')
    s.addKill('maelstrom')
    expect(s.checkpoint(60.4, 3)).toEqual({ elapsedSec: 60, kills: 1, level: 3, eurodollars: 35 })
    const r = s.result(null, 'falco', 61, 3)
    expect(r.eurodollarsCollected).toBe(35)
    expect(r.weaponsSeen).toEqual(['pistol', 'drone'])
  })

  it('returns snapshots the run cannot change afterwards', () => {
    const s = new RunStats()
    s.addKill('maelstrom')
    const r = s.result(null, 'david', 1, 1)
    s.addKill('maelstrom')
    expect(r.killsByEnemy).toEqual({ maelstrom: 1 })
  })
})

describe('CheckpointClock', () => {
  it('fires once per period of game time', () => {
    const c = new CheckpointClock(60, 0)
    expect(c.due(59.9)).toBe(0)
    expect(c.due(60)).toBe(1)
    expect(c.due(61)).toBe(0)
    expect(c.due(180.5)).toBe(2)
  })

  it('counts from the start time', () => {
    const c = new CheckpointClock(60, 595)
    expect(c.due(600)).toBe(0)
    expect(c.due(655)).toBe(1)
  })
})
