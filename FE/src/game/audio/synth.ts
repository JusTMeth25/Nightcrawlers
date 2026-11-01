// Synthesised sound effects (no audio files in the repository): oscillators, filtered noise and
// short envelopes. Each function starts one voice on `out` and returns its length in seconds.
import type { SfxId } from './sfxIds'

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** One second of white noise per context, built once. Seeded LCG: no Math.random. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (buf) return buf
  buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let seed = 0x2545f491
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    data[i] = (seed / 0xffffffff) * 2 - 1
  }
  noiseCache.set(ctx, buf)
  return buf
}

function envelope(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(out)
  return g
}

function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  from: number,
  to: number,
  peak: number,
  decay: number,
): number {
  const g = envelope(ctx, out, t, peak, 0.005, decay)
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay)
  o.connect(g)
  o.start(t)
  o.stop(t + decay + 0.02)
  return decay + 0.02
}

function noise(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  filter: BiquadFilterType,
  freq: number,
  peak: number,
  decay: number,
): number {
  const g = envelope(ctx, out, t, peak, 0.003, decay)
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t)
  f.connect(g)
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.connect(f)
  src.start(t)
  src.stop(t + decay + 0.02)
  return decay + 0.02
}

/** Starts the effect at the context's current time; returns how long it sounds. */
export function playSynth(ctx: BaseAudioContext, out: AudioNode, id: SfxId): number {
  const t = ctx.currentTime
  switch (id) {
    case 'shoot':
      return Math.max(tone(ctx, out, t, 'square', 880, 220, 0.08, 0.07), noise(ctx, out, t, 'highpass', 2500, 0.05, 0.04))
    case 'hit':
      return noise(ctx, out, t, 'bandpass', 1400, 0.12, 0.05)
    case 'kill':
      return Math.max(tone(ctx, out, t, 'triangle', 520, 90, 0.12, 0.12), noise(ctx, out, t, 'lowpass', 900, 0.1, 0.1))
    case 'pickup':
      return tone(ctx, out, t, 'sine', 990, 1760, 0.1, 0.08)
    case 'levelup':
      tone(ctx, out, t, 'triangle', 523, 523, 0.15, 0.15)
      tone(ctx, out, t + 0.1, 'triangle', 659, 659, 0.15, 0.15)
      return 0.2 + tone(ctx, out, t + 0.2, 'triangle', 784, 1046, 0.18, 0.3)
    case 'skill':
      return Math.max(tone(ctx, out, t, 'sawtooth', 220, 1320, 0.12, 0.35), noise(ctx, out, t, 'bandpass', 3000, 0.08, 0.3))
    case 'hurt':
      return Math.max(tone(ctx, out, t, 'sawtooth', 180, 60, 0.2, 0.2), noise(ctx, out, t, 'lowpass', 600, 0.15, 0.15))
    case 'chest':
      tone(ctx, out, t, 'sine', 660, 660, 0.15, 0.2)
      return 0.12 + tone(ctx, out, t + 0.12, 'sine', 990, 1320, 0.15, 0.35)
    case 'boss':
      return Math.max(tone(ctx, out, t, 'sawtooth', 110, 40, 0.25, 0.9), noise(ctx, out, t, 'lowpass', 300, 0.2, 0.8))
    case 'explode':
      return Math.max(noise(ctx, out, t, 'lowpass', 700, 0.3, 0.35), tone(ctx, out, t, 'sine', 120, 35, 0.25, 0.3))
  }
}
