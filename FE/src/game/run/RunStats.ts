// What the run reports to the server: kills, eurodollars, Codex entries (plan Task 15).
import type { CharacterId, EnemyId, RunCheckpoint, RunResult, WeaponId } from '@shared/types'

export class RunStats {
  kills = 0
  eurodollarsCollected = 0
  readonly killsByEnemy: Partial<Record<EnemyId, number>> = {}
  readonly weaponsSeen = new Set<WeaponId>()
  readonly enemiesSeen = new Set<EnemyId>()

  addKill(id: EnemyId): void {
    this.kills++
    this.killsByEnemy[id] = (this.killsByEnemy[id] ?? 0) + 1
    this.enemiesSeen.add(id)
  }

  addEurodollars(amount: number): void {
    this.eurodollarsCollected += amount
  }

  seeEnemy(id: EnemyId): void {
    this.enemiesSeen.add(id)
  }

  seeWeapon(id: WeaponId): void {
    this.weaponsSeen.add(id)
  }

  checkpoint(elapsedSec: number, level: number): RunCheckpoint {
    return { elapsedSec: Math.floor(elapsedSec), kills: this.kills, level, eurodollars: this.eurodollarsCollected }
  }

  result(runId: string | null, characterId: CharacterId, durationSec: number, level: number): RunResult {
    return {
      runId,
      characterId,
      durationSec: Math.floor(durationSec),
      kills: this.kills,
      killsByEnemy: { ...this.killsByEnemy },
      level,
      eurodollarsCollected: this.eurodollarsCollected,
      weaponsSeen: [...this.weaponsSeen],
      enemiesSeen: [...this.enemiesSeen],
    }
  }
}

/** Checkpoints every `everySec` of game time counted from `startSec`. */
export class CheckpointClock {
  private readonly every: number
  private next: number

  constructor(everySec: number, startSec: number) {
    this.every = everySec
    this.next = startSec + everySec
  }

  /** How many checkpoints fell due up to `tSec` (usually 0 or 1). */
  due(tSec: number): number {
    if (this.every <= 0) return 0
    let n = 0
    while (tSec >= this.next) {
      n++
      this.next += this.every
    }
    return n
  }
}
