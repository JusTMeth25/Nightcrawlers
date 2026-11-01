import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pub = (f) => fileURLToPath(new URL(`../../FE/public/${f}`, import.meta.url))
const SIZES = { 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 }

test('every icon exists with the expected square size', async () => {
  for (const [file, size] of Object.entries(SIZES)) {
    assert.ok(existsSync(pub(file)), file)
    const { width, height } = await sharp(pub(file)).metadata()
    assert.deepEqual([width, height], [size, size], file)
  }
})

test('the manifest lists the generated icons and the game colors', () => {
  const m = JSON.parse(readFileSync(pub('site.webmanifest'), 'utf8'))
  assert.equal(m.name, 'Nightcrawlers')
  assert.equal(m.theme_color, '#05010d')
  assert.equal(m.orientation, 'landscape')
  const srcs = m.icons.map((i) => i.src)
  for (const f of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']) assert.ok(srcs.includes(f), f)
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'))
})

test('index.html links the favicon, apple icon, manifest and theme color', () => {
  const html = readFileSync(pub('../index.html'), 'utf8')
  for (const s of ['href="/favicon.svg"', 'href="/favicon-32.png"', 'href="/apple-touch-icon.png"', 'href="/site.webmanifest"', 'name="theme-color"']) {
    assert.ok(html.includes(s), s)
  }
})
