// Why the game is paused, and the matching bus notifications.
// The menu cannot open over a level-up or chest: the UI would wait for a 'game:resumed' that
// only comes once every reason is gone, and the modal underneath would be stuck.
import type { EventBus, GameEvents } from '@shared/events'

export type PauseReason = 'menu' | 'levelup' | 'chest'

export class PauseState {
  private readonly bus: EventBus<GameEvents>
  private readonly modalOpen: () => boolean
  private readonly reasons = new Set<PauseReason>()
  private readonly off: (() => void)[]
  private readonly changeListeners = new Set<(paused: boolean) => void>()

  /** `modalOpen`: true while a level-up or chest is pending or shown. */
  constructor(bus: EventBus<GameEvents>, modalOpen: () => boolean) {
    this.bus = bus
    this.modalOpen = modalOpen
    this.off = [bus.on('pause', () => this.pause('menu')), bus.on('resume', () => this.resume('menu'))]
  }

  get paused(): boolean {
    return this.reasons.size > 0
  }

  has(reason: PauseReason): boolean {
    return this.reasons.has(reason)
  }

  pause(reason: PauseReason): void {
    if (this.reasons.has(reason)) return
    if (reason === 'menu' && this.modalOpen()) return
    this.reasons.add(reason)
    if (this.reasons.size === 1) this.notify(true)
    this.bus.emit('game:paused', { reason })
  }

  resume(reason: PauseReason): void {
    if (!this.reasons.delete(reason)) return
    if (this.reasons.size > 0) return
    this.notify(false)
    this.bus.emit('game:resumed', undefined)
  }

  /**
   * Called with true when the game freezes and false when it runs again (cosmetics follow it).
   * `now`: also call it at once with the current state (the game may be paused already).
   */
  onChange(fn: (paused: boolean) => void, now = false): () => void {
    this.changeListeners.add(fn)
    if (now && this.paused) fn(true)
    return () => {
      this.changeListeners.delete(fn)
    }
  }

  private notify(paused: boolean): void {
    for (const fn of this.changeListeners) fn(paused)
  }

  /** Esc / Start / touch pause button. */
  toggleMenu(): void {
    if (this.reasons.has('menu')) this.resume('menu')
    else this.pause('menu')
  }

  dispose(): void {
    for (const off of this.off) off()
    this.off.length = 0
    this.changeListeners.clear()
  }
}
