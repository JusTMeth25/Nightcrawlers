// Per-enemy hit cooldown for persistent damage zones (orbiting blades, beams, auras).
// Keyed by pool slot and spawn generation, so an enemy spawned into a freed slot is not
// immune because of its predecessor.

export class HitGate {
  private readonly gen: Uint32Array
  private readonly nextAt: Float64Array

  constructor(cap: number) {
    this.gen = new Uint32Array(cap)
    this.nextAt = new Float64Array(cap)
  }

  /** True (and arms the gate for `everySec`) when enemy (slot, gen) may be hit at `now`. */
  tryHit(slot: number, gen: number, now: number, everySec: number): boolean {
    if (this.gen[slot] === gen && this.nextAt[slot] > now) return false
    this.gen[slot] = gen
    this.nextAt[slot] = now + everySec
    return true
  }
}
