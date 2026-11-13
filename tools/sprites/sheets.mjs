// Source sheets and their processing settings.
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))

export const SHEETS = {
  // one regular 8x3 grid sheet per character (no weapons: the game mounts them)
  heroes: {
    mode: 'alpha',
    clean: { minAlpha: 25, minLuma: 18 },
    detect: { minArea: 300, mergeGap: 6, maskAlpha: 180 },
    // the character sheets are drawn ~2.5x bigger than the in-game pixel scale
    scale: 0.4,
    grid: {
      sources: ['david', 'lucy', 'rebecca', 'maine', 'kiwi', 'pilar', 'dorio', 'falco'].map((spriteKey) => ({
        spriteKey,
        file: `${root}assets-src/sprites/characters/${spriteKey[0].toUpperCase()}${spriteKey.slice(1)}.png`,
        // x columns where every row must split: Dorio's death pose touches her hurt pose
        cuts: spriteKey === 'dorio' ? [1300] : [],
      })),
      dirs: ['down', 'side', 'up'],
      columns: { idle: [0, 1], walk: [2, 3, 4, 5], hurt: [6], death: [7] },
    },
    out: `${root}FE/public/assets/atlas/heroes`,
  },
  enemies: {
    source: `${root}assets-src/sprites/edgerunners_enemies.png`,
    mode: 'chroma',
    clean: { threshold: 22, feather: 10 },
    detect: { minArea: 200, mergeGap: 3 },
    overrides: `${root}tools/sprites/overrides/enemies.json`,
    out: `${root}FE/public/assets/atlas/enemies`,
  },
  weapons: {
    source: `${root}assets-src/sprites/weapons.png`,
    mode: 'alpha',
    clean: { minAlpha: 25, minLuma: 18 },
    detect: { minArea: 200, mergeGap: 3 },
    // the sheet is drawn ~4x bigger than the characters' pixel scale
    scale: 0.25,
    overrides: `${root}tools/sprites/overrides/weapons.json`,
    out: `${root}FE/public/assets/atlas/weapons`,
  },
}
