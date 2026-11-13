import { afterEach, describe, expect, it } from 'vitest'
import { unlocks } from '@data'
import { SUPPORTED_LOCALES } from '@shared/types'
import { unlockText } from './dataText'
import { setLocale } from './locale'

afterEach(() => setLocale('it'))

describe('unlockText', () => {
  it('takes the numbers from the rule, formatted in the current locale', () => {
    expect(unlockText('pilar')).toBe('Raccogli 5.000 €$ in totale')
    setLocale('en')
    expect(unlockText('pilar')).toBe('Collect 5,000 €$ in total')
    expect(unlockText('maine')).toBe('Survive 10 minutes')
    expect(unlockText('falco')).toBe('Reach 15 minutes with 3 different characters')
    setLocale('es')
    expect(unlockText('pilar')).toBe('Reúne 5.000 €$ en total')
    expect(unlockText('kiwi')).toBe('Mata a 50 agentes de MaxTac en total')
  })

  it('never leaves a placeholder unfilled', () => {
    for (const locale of SUPPORTED_LOCALES) {
      setLocale(locale)
      for (const u of unlocks) expect(unlockText(u.characterId), `${locale} ${u.characterId}`).not.toMatch(/[{}]/)
    }
  })
})
