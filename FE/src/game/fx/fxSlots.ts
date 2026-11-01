// Slot allocation for FxPool: ordinary effects cycle through the general slots (the oldest is
// reused); telegraphs take reserved slots that nothing else can overwrite.

export class FxSlots {
  readonly general: number
  readonly reserved: number
  private cursor = 0
  private readonly held: Uint8Array

  constructor(general: number, reserved: number) {
    this.general = general
    this.reserved = reserved
    this.held = new Uint8Array(reserved)
  }

  /** A general slot (index < general). */
  take(): number {
    const i = this.cursor
    this.cursor = (i + 1) % this.general
    return i
  }

  /** A free reserved slot (index >= general), or -1 when all are held. */
  takeReserved(): number {
    for (let k = 0; k < this.reserved; k++) {
      if (this.held[k]) continue
      this.held[k] = 1
      return this.general + k
    }
    return -1
  }

  /** Frees a reserved slot (no effect on general slots). */
  release(slot: number): void {
    const k = slot - this.general
    if (k >= 0 && k < this.reserved) this.held[k] = 0
  }
}
