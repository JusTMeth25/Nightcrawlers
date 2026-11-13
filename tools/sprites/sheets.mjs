// Source sheets and their processing settings.
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))

export const SHEETS = {
  heroes: {
    source: `${root}assets-src/sprites/edgerunners.png`,
    mode: 'alpha',
    clean: { minAlpha: 25, minLuma: 18 },
    detect: { minArea: 200, mergeGap: 3 },
    overrides: `${root}tools/sprites/overrides/heroes.json`,
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
