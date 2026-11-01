// Signature skill cooldown (plan Task 13). Starts ready.
import type { SkillDef, Stats } from '@shared/types'

export function skillCooldown(def: SkillDef, stats: Stats): number {
  return def.cooldownSec * stats.cooldown
}

export class Cooldown {
  private duration: number
  private left = 0

  constructor(sec: number) {
    this.duration = Math.max(0, sec)
  }

  tick(dt: number): void {
    if (this.left > 0) this.left = Math.max(0, this.left - dt)
  }

  ready(): boolean {
    return this.left <= 0
  }

  /** Starts the cooldown if ready; true when the skill may fire. */
  trigger(): boolean {
    if (!this.ready()) return false
    this.left = this.duration
    return true
  }

  /** New length (cooldown stat changed): the share still to wait is kept. */
  setDuration(sec: number): void {
    const share = this.remaining01
    this.duration = Math.max(0, sec)
    this.left = share * this.duration
  }

  /** Share of the cooldown still to wait: 1 = just used, 0 = ready (HudState.skillCooldown01). */
  get remaining01(): number {
    return this.duration > 0 ? this.left / this.duration : 0
  }

  /** Share already waited: 0 = just used, 1 = ready. */
  get progress01(): number {
    return 1 - this.remaining01
  }
}
