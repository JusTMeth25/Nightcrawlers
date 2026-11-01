// Sound effects through Web Audio (plan Task 14b). The AudioContext is created on the first user
// input (autoplay policy). At most MAX_VOICES voices per effect sound together; extra plays are
// dropped. Music is out of the MVP: its volume drives a gain node kept ready for future tracks.
import { SFX_IDS, type SfxId } from './sfxIds'
import { playSynth } from './synth'

export const MAX_VOICES = 8
/** master trim so a full fight does not clip */
const SFX_TRIM = 0.6

export class AudioSystem {
  private readonly factory: () => AudioContext
  private ctx: AudioContext | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private music = 0.7
  private sfx = 0.8
  private disposed = false
  private resuming = false
  /** end times of the voices playing, per effect */
  private readonly voices = new Map<SfxId, number[]>()

  constructor(ctxFactory: () => AudioContext) {
    this.factory = ctxFactory
    for (const id of SFX_IDS) this.voices.set(id, [])
  }

  /** Call from a user gesture: creates (once) and resumes the context. */
  unlock(): void {
    if (this.disposed) return
    if (!this.ctx) {
      try {
        this.ctx = this.factory()
      } catch {
        // no Web Audio: stay silent
        this.disposed = true
        return
      }
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.connect(this.ctx.destination)
      this.applyVolumes()
    }
    this.resumeIfSuspended()
  }

  /** iOS suspends the context on interruptions; a pad-only player never sent a gesture. */
  private resumeIfSuspended(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'suspended' || this.resuming) return
    this.resuming = true
    ctx
      .resume()
      .catch(() => {})
      .finally(() => {
        this.resuming = false
      })
  }

  setVolumes(music: number, sfx: number): void {
    this.music = clamp01(music)
    this.sfx = clamp01(sfx)
    this.applyVolumes()
  }

  private applyVolumes(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfx * SFX_TRIM
    if (this.musicGain) this.musicGain.gain.value = this.music
  }

  /** Voices of `id` still sounding. */
  activeVoices(id: SfxId): number {
    const list = this.voices.get(id)
    if (!list || !this.ctx) return 0
    const now = this.ctx.currentTime
    // drop finished voices in place
    let kept = 0
    for (let i = 0; i < list.length; i++) if (list[i] > now) list[kept++] = list[i]
    list.length = kept
    return kept
  }

  play(id: SfxId): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain || this.disposed || this.sfx <= 0) return
    this.resumeIfSuspended()
    if (this.activeVoices(id) >= MAX_VOICES) return
    const length = playSynth(ctx, this.sfxGain, id)
    this.voices.get(id)?.push(ctx.currentTime + length)
  }

  dispose(): void {
    this.disposed = true
    const ctx = this.ctx
    this.ctx = null
    this.sfxGain = null
    this.musicGain = null
    if (ctx) void ctx.close().catch(() => {})
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}
