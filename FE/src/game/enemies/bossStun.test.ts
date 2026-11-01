import { describe, expect, it } from 'vitest'
import { BossBrain, stepBoss, TELEGRAPH_SEC, type BossEvent } from './bossPatterns'

describe('stepBoss with stuns', () => {
  it('never attacks without a full, uninterrupted telegraph right before', () => {
    const brain = new BossBrain(['coneBlast', 'charge'])
    const dt = 1 / 60
    let t = 0
    let telegraphAt = -1
    let last: BossEvent = 'none'
    let attacks = 0
    for (let f = 0; f < 60 * 40; f++) {
      t += dt
      // a 1 s stun every 3 s, which lands inside telegraphs
      const stunned = t % 3 < 1
      const ev = stepBoss(brain, dt, stunned)
      if (ev === 'none') continue
      if (ev === 'telegraph') telegraphAt = t
      if (ev === 'attack') {
        attacks++
        expect(last).toBe('telegraph')
        // phases carry their overshoot, so the shown telegraph may be one frame shorter
        expect(t - telegraphAt).toBeGreaterThanOrEqual(TELEGRAPH_SEC - dt - 1e-6)
      }
      last = ev
    }
    expect(attacks).toBeGreaterThan(0)
  })

  it('cancels a telegraph when the boss is stunned during it', () => {
    const brain = new BossBrain(['coneBlast'])
    let ev: BossEvent = 'none'
    while (ev !== 'telegraph') ev = stepBoss(brain, 0.1, false)
    expect(stepBoss(brain, 0.1, true)).toBe('cancel')
    expect(brain.phase).toBe('chase')
  })
})
