// 5x7 pixel digits for damage numbers. Drawn into a texture at boot and registered as a
// RetroFont (DamageNumbers.registerDigitFont), so a hit only rebuilds glyph quads.

export const FONT_KEY = 'font_digits'
export const FONT_CHARS = '0123456789'
export const GLYPH_W = 5
export const GLYPH_H = 7
/** each glyph pixel becomes GLYPH_SCALE texture pixels, with a 1 px dark outline */
export const GLYPH_SCALE = 2
export const CELL_W = GLYPH_W * GLYPH_SCALE + 2
export const CELL_H = GLYPH_H * GLYPH_SCALE + 2

// prettier-ignore
const GLYPHS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
}

export function glyphRows(ch: string): string[] {
  return GLYPHS[ch] ?? []
}
