import { afterEach, describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { it as itDict, t, type TextKey } from './it'
import { setLocale } from './locale'

afterEach(() => setLocale('it'))

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const keys = Object.keys(itDict) as TextKey[]

describe.each([
  ['en', en as Record<string, string>],
  ['es', es as Record<string, string>],
])('%s dictionary', (_name, dict) => {
  it('has exactly the Italian keys', () => {
    expect(Object.keys(dict).sort()).toEqual([...keys].sort())
  })

  it('keeps the same placeholders and has no empty text', () => {
    for (const key of keys) {
      expect(dict[key]?.trim(), key).toBeTruthy()
      expect(placeholders(dict[key]), key).toEqual(placeholders(itDict[key]))
    }
  })

  it('does not translate the logo', () => {
    expect(dict['app.title']).toBe('NIGHTCRAWLERS')
  })
})

describe('t() follows the current locale', () => {
  it('translates and fills placeholders in every language', () => {
    expect(t('menu.play')).toBe('Gioca')
    setLocale('en')
    expect(t('menu.play')).toBe('Play')
    expect(t('hud.level', { level: 3 })).toBe('Lv. 3')
    setLocale('es')
    expect(t('menu.play')).toBe('Jugar')
    expect(t('menu.greeting', { username: 'demo' })).toContain('demo')
  })
})
