import { describe, expect, it, vi } from 'vitest'
import { AudioSystem, MAX_VOICES } from './AudioSystem'

function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

function node() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(),
    frequency: param(),
    Q: param(),
    type: '',
    buffer: null as unknown,
    onended: null as unknown,
  }
}

function fakeContext() {
  const ctx = {
    currentTime: 1,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    sources: 0,
    createGain: vi.fn(() => node()),
    createOscillator: vi.fn(() => {
      ctx.sources++
      return node()
    }),
    createBufferSource: vi.fn(() => {
      ctx.sources++
      return node()
    }),
    createBiquadFilter: vi.fn(() => node()),
    createBuffer: vi.fn((_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  }
  return ctx
}

function setup() {
  const ctx = fakeContext()
  const audio = new AudioSystem(() => ctx as unknown as AudioContext)
  audio.unlock()
  return { ctx, audio }
}

describe('AudioSystem', () => {
  it('creates no context before the first user input', () => {
    const factory = vi.fn(() => fakeContext() as unknown as AudioContext)
    const audio = new AudioSystem(factory)
    audio.play('shoot')
    expect(factory).not.toHaveBeenCalled()
    audio.unlock()
    audio.unlock()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('creates no voice when the effects volume is 0', () => {
    const { ctx, audio } = setup()
    audio.setVolumes(0.5, 0)
    audio.play('shoot')
    expect(ctx.sources).toBe(0)
    expect(audio.activeVoices('shoot')).toBe(0)
  })

  it('plays at most 8 voices of the same effect at once', () => {
    const { audio } = setup()
    audio.setVolumes(0.5, 1)
    for (let i = 0; i < 9; i++) audio.play('hit')
    expect(MAX_VOICES).toBe(8)
    expect(audio.activeVoices('hit')).toBe(8)
    expect(audio.activeVoices('kill')).toBe(0)
  })

  it('frees voices once they have finished', () => {
    const { ctx, audio } = setup()
    for (let i = 0; i < 8; i++) audio.play('hit')
    ctx.currentTime += 5
    expect(audio.activeVoices('hit')).toBe(0)
    audio.play('hit')
    expect(audio.activeVoices('hit')).toBe(1)
  })

  it('closes the context on dispose and stays silent afterwards', () => {
    const { ctx, audio } = setup()
    audio.dispose()
    expect(ctx.close).toHaveBeenCalled()
    audio.play('hit')
    expect(ctx.sources).toBe(0)
  })
})
