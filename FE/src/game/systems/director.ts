// Wave director (spec 2.6, 2.7): turns game time into spawn orders. Pure: the scene places the enemies.
import { balance, enemies, waves as wavesData } from '@data/index'
import type { EnemyId, PhaseDef, WavesDef } from '@shared/types'
import type { Rng } from './rng'

export type Formation = 'scatter' | 'ring' | 'wall' | 'swarm'
export type SpawnOrder = {
  kind: 'normal' | 'elite' | 'boss'
  enemyId: EnemyId
  formation: Formation
  count: number
  bossIndex?: number
}

/** Longest step the director accepts: a tab coming back from background must not burst-spawn. */
export const MAX_DT_SEC = 0.1

export function phaseAt(tSec: number, waves: WavesDef): PhaseDef {
  for (const p of waves.phases) {
    if (tSec >= p.fromSec && (p.toSec === -1 || tSec < p.toSec)) return p
  }
  return waves.phases[waves.phases.length - 1]
}

/** Minutes past the MaxTac alert (0 before it). */
function alertMinutes(tSec: number): number {
  return Math.max(0, (tSec - wavesData.maxtacAlertAtSec) / 60)
}

export function alertMultipliers(tSec: number): { hp: number; damage: number; spawn: number } {
  const over = alertMinutes(tSec)
  const d = balance.difficulty
  return { hp: 1 + d.alertHpPerMin * over, damage: 1 + d.alertDamagePerMin * over, spawn: alertSpawnMult(tSec) }
}

/** Spawn-rate multiplier alone, for the per-frame path (no object). */
export function alertSpawnMult(tSec: number): number {
  return 1 + balance.difficulty.alertSpawnPerMin * alertMinutes(tSec)
}

const BOSS_ID: EnemyId = enemies.find((e) => e.behavior === 'boss')?.id ?? 'cyberpsycho'

/** First multiple of `every` (excluding 0) after `from`. */
function firstMultipleAfter(from: number, every: number): number {
  return (Math.floor(from / every) + 1) * every
}

type Weighted = { item: EnemyId; weight: number }[]

export class Director {
  private readonly waves: WavesDef
  private readonly rng: Rng
  private lastT: number
  private acc = 0
  private bossIndex = 0
  private readonly out: SpawnOrder[] = []
  /** spawn weights per phase, built once (no array per pick) */
  private readonly weights = new Map<PhaseDef, Weighted>()

  /** `startSec` lets a run begin later (harness `?t=`) without replaying the past. */
  constructor(waves: WavesDef, rng: Rng, startSec = 0) {
    this.waves = waves
    this.rng = rng
    this.lastT = startSec
    this.bossIndex = Math.floor(startSec / waves.bossEverySec)
    for (const p of waves.phases) {
      const list: Weighted = []
      for (let i = 0; i < p.mix.length; i++) list.push({ item: p.mix[i].enemyId, weight: p.mix[i].weight })
      this.weights.set(p, list)
    }
  }

  /**
   * Orders for the step ending at `tSec`. The returned array is reused by the next call:
   * consume it before calling `update` again.
   */
  update(tSec: number, dtSec: number, alive: number): SpawnOrder[] {
    const out = this.out
    out.length = 0
    const dt = Math.min(Math.max(dtSec, 0), MAX_DT_SEC)
    const from = this.lastT
    if (tSec <= from) return out
    this.lastT = tSec
    const phase = phaseAt(tSec, this.waves)

    const bossEvery = this.waves.bossEverySec
    const eliteEvery = this.waves.eliteEverySec
    if (bossEvery > 0) {
      for (let m = firstMultipleAfter(from, bossEvery); m <= tSec; m += bossEvery) {
        out.push({ kind: 'boss', enemyId: BOSS_ID, formation: 'scatter', count: 1, bossIndex: this.bossIndex++ })
      }
    }
    if (eliteEvery > 0) {
      for (let m = firstMultipleAfter(from, eliteEvery); m <= tSec; m += eliteEvery) {
        if (bossEvery > 0 && m % bossEvery === 0) continue
        out.push({ kind: 'elite', enemyId: this.pickEnemy(phase), formation: 'scatter', count: 1 })
      }
    }
    const phases = this.waves.phases
    for (let i = 0; i < phases.length; i++) {
      const specials = phases[i].specials
      for (let j = 0; j < specials.length; j++) {
        const s = specials[j]
        if (s.atSec > from && s.atSec <= tSec) {
          out.push({ kind: 'normal', enemyId: s.enemyId, formation: s.type, count: s.count })
        }
      }
    }

    this.acc += phase.spawnPerSec * alertSpawnMult(tSec) * dt
    let n = Math.floor(this.acc)
    this.acc -= n
    const room = Math.max(0, this.waves.enemyCap - alive)
    if (n > room) {
      n = room
      this.acc = 0
    }
    for (let i = 0; i < n; i++) {
      const enemyId = this.pickEnemy(phase)
      let same: SpawnOrder | null = null
      for (let k = 0; k < out.length; k++) {
        const o = out[k]
        if (o.kind === 'normal' && o.formation === 'scatter' && o.enemyId === enemyId) same = o
      }
      if (same) same.count++
      else out.push({ kind: 'normal', enemyId, formation: 'scatter', count: 1 })
    }
    return out
  }

  private pickEnemy(phase: PhaseDef): EnemyId {
    return this.rng.weighted(this.weights.get(phase) ?? [])
  }
}
