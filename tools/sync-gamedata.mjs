// Copies the game data the backend needs from FE/src/data to BE resources.
// Usage: node tools/sync-gamedata.mjs [--check]
// --check writes nothing and exits 1 when the copies differ.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = process.env.GAMEDATA_SRC ?? join(root, 'FE', 'src', 'data')
const dst = process.env.GAMEDATA_DST ?? join(root, 'BE', 'src', 'main', 'resources', 'gamedata')
const FILES = ['characters', 'enemies', 'weapons', 'unlocks', 'ripperdoc', 'balance'].map((f) => `${f}.json`)

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

if (process.argv.includes('--check')) {
  const diverged = FILES.filter((f) => !existsSync(join(dst, f)) || read(join(src, f)) !== read(join(dst, f)))
  if (diverged.length > 0) {
    console.error(`Game data out of sync (run: node tools/sync-gamedata.mjs): ${diverged.join(', ')}`)
    process.exit(1)
  }
  console.log('Game data in sync.')
} else {
  mkdirSync(dst, { recursive: true })
  for (const f of FILES) writeFileSync(join(dst, f), read(join(src, f)))
  console.log(`Copied ${FILES.length} files to ${dst}`)
}
