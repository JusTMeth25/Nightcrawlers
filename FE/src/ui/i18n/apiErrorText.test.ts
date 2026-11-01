import { describe, expect, it } from 'vitest'
import { ApiError, problemError } from '../../api/errors'
import { apiErrorText, withErrorId } from './apiErrorText'

function serverError(errorId?: string) {
  return new ApiError(500, { type: 'about:blank', title: 'Errore interno', status: 500, ...(errorId ? { errorId } : {}) }, null)
}

describe('apiErrorText', () => {
  it('appends the error code of a 500 to the generic text so the user can report it', () => {
    expect(apiErrorText(serverError('a1b2-c3'))).toBe('Qualcosa è andato storto. Riprova. (codice: a1b2-c3)')
  })

  it('keeps the plain generic text without an errorId', () => {
    expect(apiErrorText(serverError())).toBe('Qualcosa è andato storto. Riprova.')
    expect(apiErrorText(new Error('boom'))).toBe('Qualcosa è andato storto. Riprova.')
  })

  it('network and rate-limit texts are unchanged', () => {
    expect(apiErrorText(new ApiError(0, null, null))).toMatch(/Impossibile contattare il server/)
    expect(apiErrorText(problemError(429, 'Troppe richieste', undefined, 7))).toBe('Troppi tentativi, riprova tra 7 secondi')
  })

  it('withErrorId adds the code to any text, only when present', () => {
    expect(withErrorId('Errore', serverError('x9'))).toBe('Errore (codice: x9)')
    expect(withErrorId('Errore', serverError())).toBe('Errore')
    expect(withErrorId('Errore', null)).toBe('Errore')
  })
})
