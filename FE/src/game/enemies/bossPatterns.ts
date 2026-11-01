// Boss rules without Phaser (spec 2.6, plan Task 14): pattern list per return, HP growth and the
// attack cycle (chase, 0.8 s telegraph, attack, recover).
import { balance } from '@data/index'
import { alertMultipliers } from '../systems/director'

export type PatternId = 'coneBlast' | 'charge' | 'summon' | 'shockwave'

/** Unlock order: the first boss only has the cone blast. */
export const PATTERN_ORDER: readonly PatternId[] = ['coneBlast', 'charge', 'summon', 'shockwave']

export const TELEGRAPH_SEC = 0.8
/** chasing time between two attacks */
export const CHASE_SEC = 2.2
/** how long each attack keeps the boss busy */
export const ATTACK_SEC: Record<PatternId, number> = {
  coneBlast: 0.4,
  charge: 0.9,
  summon: 0.5,
  shockwave: 0.6,
}

export function bossPatternsFor(bossIndex: number): PatternId[] {
  const n = Math.min(balance.boss.maxPatterns, PATTERN_ORDER.length, Math.max(0, bossIndex) + 1)
  return PATTERN_ORDER.slice(0, n)
}

export function bossHp(baseHp: number, bossIndex: number, tSec: number): number {
  return baseHp * balance.boss.hpGrowth ** bossIndex * alertMultipliers(tSec).hp
}

export type BossPhase = 'chase' | 'telegraph' | 'attack'
/** what changed in this update */
export type BossEvent = 'none' | 'telegraph' | 'attack' | 'recover' | 'cancel'

/** after a cancelled telegraph the boss tries the same pattern again this soon */
export const RETRY_SEC = 0.3

export class BossBrain {
  phase: BossPhase = 'chase'
  private readonly patterns: readonly PatternId[]
  private next = 0
  private current: PatternId
  private left = CHASE_SEC

  constructor(patterns: readonly PatternId[]) {
    this.patterns = patterns.length > 0 ? patterns : PATTERN_ORDER.slice(0, 1)
    this.current = this.patterns[0]
  }

  /** Pattern being telegraphed or performed. */
  get pattern(): PatternId {
    return this.current
  }

  /** Seconds left in the current phase. */
  get phaseLeft(): number {
    return this.left
  }

  /** Stunned during a telegraph: back to chasing, the same pattern comes next. */
  cancelTelegraph(): boolean {
    if (this.phase !== 'telegraph') return false
    this.phase = 'chase'
    this.left = RETRY_SEC
    this.next = (this.next - 1 + this.patterns.length) % this.patterns.length
    return true
  }

  update(dt: number): BossEvent {
    this.left -= dt
    if (this.left > 0) return 'none'
    switch (this.phase) {
      case 'chase':
        this.current = this.patterns[this.next]
        this.next = (this.next + 1) % this.patterns.length
        this.phase = 'telegraph'
        this.left += TELEGRAPH_SEC
        return 'telegraph'
      case 'telegraph':
        this.phase = 'attack'
        this.left += ATTACK_SEC[this.current]
        return 'attack'
      case 'attack':
        this.phase = 'chase'
        this.left += CHASE_SEC
        return 'recover'
    }
  }
}

/**
 * One boss step. A stun freezes the boss; a stun during a telegraph cancels it ('cancel'), so an
 * attack always follows a full telegraph that was on screen right before it.
 */
export function stepBoss(brain: BossBrain, dt: number, stunned: boolean): BossEvent {
  if (stunned) return brain.cancelTelegraph() ? 'cancel' : 'none'
  return brain.update(dt)
}
