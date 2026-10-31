import { describe, expect, it } from 'vitest'
import enemiesAtlas from '../../../public/assets/atlas/enemies.json'
import heroesAtlas from '../../../public/assets/atlas/heroes.json'
import { animConfig, animKey, groupFrames, resolveAnim } from './animations'

const available = (atlas: { frames: Record<string, unknown> }) => new Set(groupFrames(Object.keys(atlas.frames)).keys())
const enemies = available(enemiesAtlas)
const heroes = available(heroesAtlas)

describe('groupFrames', () => {
  it('groups by animation and sorts by frame number', () => {
    const groups = groupFrames(['david_down_walk_1', 'david_down_walk_0', 'david_fx_0', 'david_down_walk_10'])
    expect(groups.get('david_down_walk')).toEqual(['david_down_walk_0', 'david_down_walk_1', 'david_down_walk_10'])
    expect(groups.get('david_fx')).toEqual(['david_fx_0'])
  })
})

describe('resolveAnim', () => {
  it('uses the requested direction when present', () => {
    expect(resolveAnim(heroes, 'david', 'up', 'walk')).toBe(animKey('david', 'up', 'walk'))
  })

  it('falls back to the same action in another direction before idle', () => {
    expect(resolveAnim(enemies, 'maxtac', 'down', 'death')).toBe('maxtac_side_death')
    expect(resolveAnim(heroes, 'maine', 'side', 'walk')).toBe('maine_down_walk')
  })

  it('uses idle only when the action exists nowhere', () => {
    expect(resolveAnim(enemies, 'maxtac', 'down', 'skill')).toBe('maxtac_down_idle')
    expect(resolveAnim(heroes, 'maine', 'side', 'nope')).toBe('maine_down_idle')
  })

  it('returns null for an unknown sprite key', () => {
    expect(resolveAnim(heroes, 'kiwi', 'down', 'walk')).toBeNull()
  })
})

describe('animConfig', () => {
  it('loops movement and plays hurt and death once', () => {
    expect(animConfig('walk')).toEqual({ frameRate: 10, repeat: -1 })
    expect(animConfig('idle').frameRate).toBe(6)
    expect(animConfig('death')).toEqual({ frameRate: 8, repeat: 0 })
    expect(animConfig('hurt').repeat).toBe(0)
  })
})
