import { describe, expect, it } from 'vitest'
import { waves } from '@data/index'
import { alertMultipliers, Director, phaseAt, type SpawnOrder } from './director'
import { createRng } from './rng'

const run = (from: number, to: number, alive = 0) => {
  const d = new Director(waves, createRng(1))
  const hits: { t: number; order: SpawnOrder }[] = []
  const step = 1 / 60
  for (let i = Math.round(from / step) + 1; i <= Math.round(to / step); i++) {
    const t = i * step
    for (const order of d.update(t, step, alive)) hits.push({ t, order: { ...order } })
  }
  return hits
}

describe('phaseAt', () => {
  it('finds the phase for a time, the last one being endless', () => {
    expect(phaseAt(0, waves).mix.map((m) => m.enemyId)).toEqual(['maelstrom'])
    expect(phaseAt(400, waves).mix.map((m) => m.enemyId)).toContain('arasaka')
    expect(phaseAt(99999, waves).toSec).toBe(-1)
  })
})

describe('alertMultipliers', () => {
  it('is 1 before the MaxTac alert and grows per minute after', () => {
    expect(alertMultipliers(1800)).toEqual({ hp: 1, damage: 1, spawn: 1 })
    expect(alertMultipliers(1860).hp).toBeCloseTo(1.03)
    expect(alertMultipliers(1890).spawn).toBeCloseTo(1.03)
  })
})

describe('Director', () => {
  it('spawns normal enemies and an elite at 300', () => {
    const hits = run(0, 300)
    expect(hits.some((h) => h.order.kind === 'normal')).toBe(true)
    const elites = hits.filter((h) => h.order.kind === 'elite')
    expect(elites).toHaveLength(1)
    expect(elites[0].t).toBeCloseTo(300)
    expect(elites[0].order.count).toBe(1)
  })

  it('fires the special horde once at its time', () => {
    const specials = run(0, 300).filter((h) => h.order.formation === 'swarm')
    expect(specials).toHaveLength(1)
    expect(specials[0].t).toBeCloseTo(150)
    expect(specials[0].order).toMatchObject({ enemyId: 'maelstrom', count: 30 })
  })

  it('spawns bosses every 600 s with a growing index and no elite on top', () => {
    const hits = run(0, 1200, 400)
    const bosses = hits.filter((h) => h.order.kind === 'boss')
    expect(bosses.map((b) => [Math.round(b.t), b.order.bossIndex])).toEqual([
      [600, 0],
      [1200, 1],
    ])
    expect(bosses[0].order.enemyId).toBe('cyberpsycho')
    const elites = hits.filter((h) => h.order.kind === 'elite').map((h) => Math.round(h.t))
    expect(elites).toEqual([300, 900])
  })

  it('clamps a huge delta', () => {
    const a = new Director(waves, createRng(4)).update(10, 5, 0)
    const countA = a.reduce((n, o) => n + o.count, 0)
    const b = new Director(waves, createRng(4)).update(10, 0.1, 0)
    const countB = b.reduce((n, o) => n + o.count, 0)
    expect(countA).toBeLessThanOrEqual(countB)
  })

  it('stops normal spawns at the cap but still sends the elite', () => {
    const d = new Director(waves, createRng(2))
    for (let t = 1; t < 300; t++) {
      expect(d.update(t, 0.1, waves.enemyCap).filter((o) => o.kind === 'normal' && o.formation === 'scatter')).toEqual([])
    }
    expect(d.update(300, 0.1, waves.enemyCap).map((o) => o.kind)).toEqual(['elite'])
  })
})

describe('Director allocations', () => {
  it('never maps the phase mix while updating', () => {
    const copy: typeof waves = JSON.parse(JSON.stringify(waves))
    for (const p of copy.phases) {
      p.mix.map = () => {
        throw new Error('mix.map called')
      }
    }
    const d = new Director(copy, createRng(3))
    for (let i = 1; i <= 400 * 60; i += 6) d.update(i / 60, 0.1, 0)
  })
})
