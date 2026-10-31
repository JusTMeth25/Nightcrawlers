import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_OPTIONS, type RunConfig } from '@shared/types'
import GameCanvas from './GameCanvas'

const config: RunConfig = {
  mode: 'guest',
  runId: null,
  seed: 42,
  characterId: 'lucy',
  ripperdoc: {},
  options: DEFAULT_OPTIONS,
}

describe('GameCanvas stub', () => {
  it('renders the game container', () => {
    render(<GameCanvas config={config} onEnd={() => {}} />)
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('ends the run with the configured character', () => {
    const onEnd = vi.fn()
    render(<GameCanvas config={config} onEnd={onEnd} />)
    fireEvent.click(screen.getByRole('button', { name: /termina run/i }))
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'lucy', durationSec: 0, kills: 0, level: 1 }))
  })
})
