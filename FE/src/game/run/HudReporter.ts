// hud:update at most 10 times per second (plan Global Constraints). The scene asks `due` first so
// it builds the HudState object only when it will be sent (no per-frame allocation).
import type { EventBus, GameEvents } from '@shared/events'
import type { HudState } from '@shared/types'

export const HUD_INTERVAL_MS = 100

export class HudReporter {
  private readonly bus: EventBus<GameEvents>
  private last = Number.NEGATIVE_INFINITY

  constructor(bus: EventBus<GameEvents>) {
    this.bus = bus
  }

  due(nowMs: number): boolean {
    return nowMs - this.last >= HUD_INTERVAL_MS
  }

  maybeEmit(nowMs: number, state: HudState): void {
    if (!this.due(nowMs)) return
    this.last = nowMs
    this.bus.emit('hud:update', state)
  }
}
