import { describe, expect, it } from 'vitest'
import { FONT_CHARS, GLYPH_H, GLYPH_W, glyphRows } from './digitFont'

describe('digit font', () => {
  it('has a 5x7 glyph for every digit, each one distinct', () => {
    expect(FONT_CHARS).toBe('0123456789')
    const seen = new Set<string>()
    for (const ch of FONT_CHARS) {
      const rows = glyphRows(ch)
      expect(rows).toHaveLength(GLYPH_H)
      for (const r of rows) expect(r).toMatch(new RegExp(`^[#.]{${GLYPH_W}}$`))
      expect(rows.join('')).toContain('#')
      seen.add(rows.join(''))
    }
    expect(seen.size).toBe(10)
  })
})
