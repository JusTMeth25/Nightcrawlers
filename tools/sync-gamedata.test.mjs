import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./sync-gamedata.mjs', import.meta.url))
const FILES = ['characters', 'enemies', 'weapons', 'unlocks', 'ripperdoc', 'balance']
let dir, src, dst

const run = (...args) =>
  spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, GAMEDATA_SRC: src, GAMEDATA_DST: dst },
    encoding: 'utf8',
  })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nc-sync-'))
  src = join(dir, 'src')
  dst = join(dir, 'dst')
  mkdirSync(src)
  for (const f of FILES) writeFileSync(join(src, `${f}.json`), `{"name":"${f}"}\n`)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

test('copies every shared file', () => {
  assert.equal(run().status, 0)
  for (const f of FILES) assert.equal(readFileSync(join(dst, `${f}.json`), 'utf8'), `{"name":"${f}"}\n`)
})

test('--check passes on identical copies, ignoring line endings', () => {
  run()
  writeFileSync(join(dst, 'balance.json'), '{"name":"balance"}\r\n')
  assert.equal(run('--check').status, 0)
})

test('--check fails and names the file that diverged', () => {
  run()
  writeFileSync(join(dst, 'unlocks.json'), '{"name":"changed"}\n')
  const res = run('--check')
  assert.equal(res.status, 1)
  assert.match(res.stdout + res.stderr, /unlocks\.json/)
})

test('--check fails when a destination file is missing', () => {
  const res = run('--check')
  assert.equal(res.status, 1)
  assert.match(res.stdout + res.stderr, /characters\.json/)
})
