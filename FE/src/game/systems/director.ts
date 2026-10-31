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

export function alertMultipliers(tSec: number): { hp: number; damage: number; spawn: number } {
  const over = (tSec - wavesData.maxtacAlertAtSec) / 60
  if (over <= 0) return { hp: 1, damage: 1, spawn: 1 }
  const d = balance.difficulty
  return { hp: 1 + d.alertHpPerMin * over, damage: 1 + d.alertDamagePerMin * over, spawn: 1 + d.alertSpawnPerMin * over }
}

const BOSS_ID: EnemyId = enemies.find((e) => e.behavior === 'boss')?.id ?? 'cyberpsycho'

/** Every multiple of `every` (excluding 0) in (from, to]. */
function crossed(from: number, to: number, every: number, fn: (m: number) => void) {
  if (every <= 0) return
  for (let k = Math.floor(from / every) + 1; k * every <= to; k++) fn(k * every)
}

export class Director {
  private readonly waves: WavesDef
  private readonly rng: Rng
  private lastT: number
  private acc = 0
  private bossIndex = 0
  private readonly out: SpawnOrder[] = []

  /** `startSec` lets a run begin later (harness `?t=`) without replaying the past. */
  constructor(waves: WavesDef, rng: Rng, startSec = 0) {
    this.waves = waves
    this.rng = rng
    this.lastT = startSec
    this.bossIndex = Math.floor(startSec / waves.bossEverySec)
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

    crossed(from, tSec, this.waves.bossEverySec, () => {
      out.push({ kind: 'boss', enemyId: BOSS_ID, formation: 'scatter', count: 1, bossIndex: this.bossIndex++ })
    })
    crossed(from, tSec, this.waves.eliteEverySec, (m) => {
      if (m % this.waves.bossEverySec === 0) return
      out.push({ kind: 'elite', enemyId: this.pickEnemy(phase), formation: 'scatter', count: 1 })
    })
    for (const p of this.waves.phases) {
      for (const s of p.specials) {
        if (s.atSec > from && s.atSec <= tSec) {
          out.push({ kind: 'normal', enemyId: s.enemyId, formation: s.type, count: s.count })
        }
      }
    }

    this.acc += phase.spawnPerSec * alertMultipliers(tSec).spawn * dt
    let n = Math.floor(this.acc)
    this.acc -= n
    const room = Math.max(0, this.waves.enemyCap - alive)
    if (n > room) {
      n = room
      this.acc = 0
    }
    for (let i = 0; i < n; i++) {
      const enemyId = this.pickEnemy(phase)
      const same = out.find((o) => o.kind === 'normal' && o.formation === 'scatter' && o.enemyId === enemyId)
      if (same) same.count++
      else out.push({ kind: 'normal', enemyId, formation: 'scatter', count: 1 })
    }
    return out
  }

  private pickEnemy(phase: PhaseDef): EnemyId {
    return this.rng.weighted(phase.mix.map((m) => ({ item: m.enemyId, weight: m.weight })))
  }
}
