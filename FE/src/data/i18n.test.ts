import { describe, expect, it } from 'vitest'
import en from './i18n/en.json'
import es from './i18n/es.json'
import { cyberware, enemies, ripperdoc, skills, unlocks, weapons } from './index'

// every data text shown by the UI has a translation (spec §4); keys are flat
const expectedKeys = [
  ...weapons.flatMap((w) => [`weapon.${w.id}.name`, `weapon.${w.id}.description`, `weapon.${w.id}.evolution`]),
  ...skills.flatMap((s) => [`skill.${s.id}.name`, `skill.${s.id}.description`]),
  ...cyberware.flatMap((c) => [`cyberware.${c.id}.name`, `cyberware.${c.id}.description`]),
  ...ripperdoc.map((r) => `ripperdoc.${r.id}.name`),
  ...unlocks.map((u) => `unlock.${u.characterId}`),
  ...enemies.map((e) => `enemy.${e.id}.name`),
].sort()

describe.each([
  ['en', en as Record<string, string>],
  ['es', es as Record<string, string>],
])('data texts %s', (_name, texts) => {
  it('has every key of every id and no orphan keys', () => {
    expect(Object.keys(texts).sort()).toEqual(expectedKeys)
  })

  it('has no empty text', () => {
    for (const [key, value] of Object.entries(texts)) expect(value.trim(), key).not.toBe('')
  })
})
