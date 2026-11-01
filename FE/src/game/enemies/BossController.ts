// Drives every boss on the field (plan Task 14): chase, then a 0.8 s telegraph, then one of its
// patterns, in turn. The pool keeps owning HP, knockback and contact damage; the chest on death
// comes from the scene's loot rules. bossHp01 feeds HudState.
import { BossBrain, bossPatternsFor, type PatternId } from './bossPatterns'
import { charge } from './patterns/charge'
import { coneBlast } from './patterns/coneBlast'
import { shockwave } from './patterns/shockwave'
import { summon } from './patterns/summon'
import type { BossHost, BossState, Pattern } from './patterns/types'

const MAX_BOSSES = 4
const PATTERNS: Record<PatternId, Pattern> = { coneBlast, charge, summon, shockwave }

interface Tracked extends BossState {
  gen: number
  brain: BossBrain
  /** order of arrival: the HUD bar follows the oldest boss alive */
  order: number
}

export class BossController {
  private readonly host: BossHost
  private readonly bosses: Tracked[] = []
  private arrivals = 0

  constructor(host: BossHost) {
    this.host = host
  }

  /** Takes over the boss just spawned in `slot`. */
  add(slot: number, bossIndex: number): void {
    const e = this.host.enemies
    if (this.bosses.length >= MAX_BOSSES) return
    e.controlled[slot] = 1
    this.bosses.push({ slot, gen: e.gen[slot], brain: new BossBrain(bossPatternsFor(bossIndex)), dirX: 0, dirY: 1, order: this.arrivals++ })
    this.host.sfx('boss')
    this.host.screen.shake(0.4, 5)
  }

  get count(): number {
    return this.bosses.length
  }

  /** HP share of the oldest boss alive, or null without bosses. */
  get bossHp01(): number | null {
    const e = this.host.enemies
    let best: Tracked | null = null
    for (const b of this.bosses) if (!best || b.order < best.order) best = b
    if (!best) return null
    return Math.max(0, e.hp[best.slot] / e.maxHp[best.slot])
  }

  update(dt: number): void {
    const host = this.host
    const e = host.enemies
    const p = host.player
    // forget bosses that died (their slot may already hold another enemy)
    for (let k = this.bosses.length - 1; k >= 0; k--) {
      const b = this.bosses[k]
      if (!e.active[b.slot] || e.gen[b.slot] !== b.gen) this.bosses.splice(k, 1)
    }
    const step = dt * e.slow
    for (const b of this.bosses) {
      const i = b.slot
      if (e.stunned(i)) continue
      const dx = p.x - e.x[i]
      const dy = p.y - e.y[i]
      const d = Math.hypot(dx, dy) || 1
      const brain = b.brain
      const ev = brain.update(step)
      const pattern = PATTERNS[brain.pattern]
      if (ev === 'telegraph') {
        b.dirX = dx / d
        b.dirY = dy / d
        pattern.telegraph(host, b, brain.phaseLeft / e.slow)
      } else if (ev === 'attack') {
        pattern.attack(host, b)
      }
      if (brain.phase === 'chase') {
        const speed = e.def(i).speed
        e.x[i] += (dx / d) * speed * step
        e.y[i] += (dy / d) * speed * step
        e.face(i, dx / d, dy / d, 'walk')
      } else {
        if (brain.phase === 'attack') pattern.update?.(host, b, step)
        e.face(i, b.dirX, b.dirY, 'skill')
      }
    }
  }
}
