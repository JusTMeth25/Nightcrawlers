import { StrictMode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameBus } from '@shared/events'
import { DEFAULT_OPTIONS, type RunConfig, type RunResult } from '@shared/types'

const games = vi.hoisted(() => ({ created: 0, alive: 0, maxAlive: 0, destroyCalls: [] as unknown[] }))

vi.mock('phaser', () => {
  class Game {
    destroyed = false
    constructor() {
      games.created++
      games.alive++
      games.maxAlive = Math.max(games.maxAlive, games.alive)
    }
    destroy(removeCanvas: boolean) {
      games.destroyCalls.push(removeCanvas)
      if (!this.destroyed) games.alive--
      this.destroyed = true
    }
  }
  class Scene {}
  const Phaser = { Game, Scene, AUTO: 0, Scale: { RESIZE: 3, Events: { RESIZE: 'resize' } } }
  return { default: Phaser, ...Phaser }
})

import GameCanvas from './GameCanvas'

const config: RunConfig = {
  mode: 'guest',
  runId: 'run-7',
  seed: 42,
  characterId: 'lucy',
  ripperdoc: {},
  options: DEFAULT_OPTIONS,
}

const result: RunResult = {
  runId: 'run-7',
  characterId: 'lucy',
  durationSec: 12,
  kills: 3,
  killsByEnemy: { maelstrom: 3 },
  level: 2,
  eurodollarsCollected: 0,
  weaponsSeen: ['monowire'],
  enemiesSeen: ['maelstrom'],
}

afterEach(() => {
  // unmount first, so the counters start clean for the next test
  cleanup()
  games.created = 0
  games.alive = 0
  games.maxAlive = 0
  games.destroyCalls.length = 0
})

describe('GameCanvas', () => {
  it('renders the game container', () => {
    const { getByTestId } = render(<GameCanvas config={config} onEnd={() => {}} />)
    expect(getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('keeps a single live Phaser game under StrictMode and destroys it on unmount', async () => {
    const { unmount } = render(
      <StrictMode>
        <GameCanvas config={config} onEnd={() => {}} />
      </StrictMode>,
    )
    // Phaser loads lazily
    await waitFor(() => expect(games.created).toBeGreaterThanOrEqual(1), { timeout: 10000 })
    expect(games.maxAlive).toBe(1)
    expect(games.alive).toBe(1)
    unmount()
    expect(games.alive).toBe(0)
    expect(games.destroyCalls.every((r) => r === true)).toBe(true)
  })

  it('calls onEnd once on run:end and never after unmount', () => {
    const onEnd = vi.fn()
    const { unmount } = render(
      <StrictMode>
        <GameCanvas config={config} onEnd={onEnd} />
      </StrictMode>,
    )
    gameBus.emit('run:end', result)
    gameBus.emit('run:end', result)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(result)
    unmount()
    gameBus.emit('run:end', result)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('answers the pause command with game:paused (menu)', () => {
    const paused = vi.fn()
    const off = gameBus.on('game:paused', paused)
    const { unmount } = render(<GameCanvas config={config} onEnd={() => {}} />)
    gameBus.emit('pause', undefined)
    expect(paused).toHaveBeenCalledWith({ reason: 'menu' })
    gameBus.emit('resume', undefined)
    unmount()
    off()
  })

  it('ends the run at once on run:quit', () => {
    const onEnd = vi.fn()
    const { unmount } = render(<GameCanvas config={config} onEnd={onEnd} />)
    gameBus.emit('run:quit', undefined)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0][0]).toMatchObject({ runId: 'run-7', characterId: 'lucy' })
    unmount()
  })

  it('leaves no bus listener behind after unmount', () => {
    const paused = vi.fn()
    const off = gameBus.on('game:paused', paused)
    const { unmount } = render(<GameCanvas config={config} onEnd={() => {}} />)
    unmount()
    gameBus.emit('pause', undefined)
    expect(paused).not.toHaveBeenCalled()
    off()
  })
})
