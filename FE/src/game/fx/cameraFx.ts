// Screen shake and flash driven by game time: they advance only inside the simulation step, so
// they freeze with the game (Phaser's own camera effects run on real time). Pure, no Phaser.
import type { Rng } from '../systems/rng'

export class ShakeState {
  x = 0
  y = 0
  private left = 0
  private intensity = 0
  private readonly rng: Rng

  /** `rng` is cosmetic only: never the gameplay RNG, so options do not change the run. */
  constructor(rng: Rng) {
    this.rng = rng
  }

  get active(): boolean {
    return this.left > 0
  }

  /** Shake for `durationSec` with offsets up to `intensity` world units. */
  start(durationSec: number, intensity: number): void {
    this.intensity = Math.max(this.active ? this.intensity : 0, intensity)
    this.left = Math.max(this.left, durationSec)
  }

  update(dt: number): void {
    if (this.left <= 0) return
    this.left -= dt
    if (this.left <= 0) {
      this.left = 0
      this.intensity = 0
      this.x = 0
      this.y = 0
      return
    }
    this.x = (this.rng.next() * 2 - 1) * this.intensity
    this.y = (this.rng.next() * 2 - 1) * this.intensity
  }
}

export class FlashState {
  color = 0xffffff
  private left = 0
  private duration = 1

  get alpha(): number {
    return this.left > 0 ? this.left / this.duration : 0
  }

  start(durationSec: number, color: number): void {
    this.left = durationSec
    this.duration = durationSec > 0 ? durationSec : 1
    this.color = color
  }

  update(dt: number): void {
    if (this.left > 0) this.left = Math.max(0, this.left - dt)
  }
}
