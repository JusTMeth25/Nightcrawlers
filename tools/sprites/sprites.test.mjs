import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromaBlack, cleanAlpha } from './clean.mjs'
import { detectFrames } from './detect.mjs'

const rgba = (w, h, fill = [0, 0, 0, 0]) => {
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) buf.set(fill, i * 4)
  return buf
}
const setPx = (buf, w, x, y, px) => buf.set(px, (y * w + x) * 4)
const square = (buf, w, x0, y0, size) => {
  for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) setPx(buf, w, x, y, [200, 50, 50, 255])
}

test('cleanAlpha drops faint halo pixels and keeps opaque ones', () => {
  const buf = rgba(2, 1)
  setPx(buf, 2, 0, 0, [255, 255, 255, 10])
  setPx(buf, 2, 1, 0, [255, 255, 255, 255])
  const out = cleanAlpha(buf, 2, 1)
  assert.equal(out[3], 0)
  assert.equal(out[7], 255)
})

test('cleanAlpha drops dark semi-transparent pixels', () => {
  const buf = rgba(1, 1, [5, 5, 5, 150])
  assert.equal(cleanAlpha(buf, 1, 1)[3], 0)
})

test('chromaBlack turns near-black transparent and keeps colors opaque', () => {
  const rgb = Buffer.from([5, 5, 5, 200, 40, 40])
  const out = chromaBlack(rgb, 2, 1)
  assert.equal(out.length, 8)
  assert.equal(out[3], 0)
  assert.equal(out[7], 255)
})

test('detectFrames finds two separate squares ordered by x', () => {
  const w = 100, h = 40
  const buf = rgba(w, h)
  square(buf, w, 60, 10, 20)
  square(buf, w, 10, 10, 20)
  const rects = detectFrames(buf, w, h)
  assert.equal(rects.length, 2)
  assert.deepEqual(rects[0], { x: 10, y: 10, w: 20, h: 20 })
  assert.equal(rects[1].x, 60)
})

test('detectFrames merges blobs closer than mergeGap', () => {
  const w = 100, h = 40
  const buf = rgba(w, h)
  square(buf, w, 10, 10, 20)
  square(buf, w, 32, 10, 20)
  assert.equal(detectFrames(buf, w, h).length, 1)
})

test('detectFrames discards blobs smaller than minArea', () => {
  const w = 40, h = 40
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 5)
  assert.equal(detectFrames(buf, w, h).length, 0)
})

test('detectFrames orders rows top to bottom', () => {
  const w = 100, h = 100
  const buf = rgba(w, h)
  square(buf, w, 60, 5, 20)
  square(buf, w, 10, 60, 20)
  const rects = detectFrames(buf, w, h)
  assert.deepEqual(rects.map((r) => r.y), [5, 60])
})

test('detectInRows splits uniform row bands and columns by projection', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 120, h = 80
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 20)
  square(buf, w, 50, 8, 20)
  square(buf, w, 10, 45, 20)
  // faint halo bridging the two top squares must not merge them
  for (let x = 25; x < 50; x++) setPx(buf, w, x, 15, [255, 255, 255, 60])
  const rows = detectInRows(buf, w, h, { rows: 2, maskAlpha: 128, edgeAlpha: 128, minArea: 100, mergeGap: 2 })
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0].map((r) => r.x), [5, 50])
  assert.deepEqual(rows[0][1], { x: 50, y: 8, w: 20, h: 20 })
  assert.deepEqual(rows[1].map((r) => r.x), [10])
})

test('detectInRows accepts explicit row bands', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 60, h = 100
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 20)
  square(buf, w, 5, 60, 20)
  const rows = detectInRows(buf, w, h, { rows: [[0, 40], [40, 100]], maskAlpha: 128, minArea: 100 })
  assert.deepEqual(rows.map((r) => r[0].y), [5, 60])
})

test('detectInRows splits a band at forced cut columns', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 80, h = 30
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 20)
  // muzzle flash bridging into the next sprite
  for (let x = 25; x < 45; x++) setPx(buf, w, x, 15, [255, 220, 80, 255])
  square(buf, w, 45, 5, 20)
  const plain = detectInRows(buf, w, h, { rows: [[0, 30]], maskAlpha: 128, minArea: 50 })
  assert.equal(plain[0].length, 1)
  const cut = detectInRows(buf, w, h, { rows: [[0, 30]], cuts: [[45]], maskAlpha: 128, minArea: 50 })
  assert.deepEqual(cut[0].map((r) => [r.x, r.w]), [[5, 40], [45, 20]])
})

test('shelfPack places rects without overlap inside maxWidth', async () => {
  const { shelfPack } = await import('./pack.mjs')
  const sizes = [{ w: 50, h: 40 }, { w: 60, h: 30 }, { w: 70, h: 50 }, { w: 20, h: 20 }]
  const { positions, width, height } = shelfPack(sizes, { maxWidth: 130, padding: 2 })
  assert.ok(width <= 130)
  positions.forEach((p, i) => {
    assert.ok(p.x + sizes[i].w <= width && p.y + sizes[i].h <= height)
    positions.forEach((q, j) => {
      if (i >= j) return
      const overlap = p.x < q.x + sizes[j].w && q.x < p.x + sizes[i].w && p.y < q.y + sizes[j].h && q.y < p.y + sizes[i].h
      assert.equal(overlap, false, `${i} overlaps ${j}`)
    })
  })
})

test('feetPivot centers on the lowest solid rows', async () => {
  const { feetPivot } = await import('./pack.mjs')
  const w = 40, h = 20
  const buf = rgba(w, h)
  // body on the left, muzzle flash higher on the right
  square(buf, w, 0, 4, 16)
  for (let x = 20; x < 40; x++) setPx(buf, w, x, 6, [255, 200, 0, 255])
  const p = feetPivot(buf, w, h, 180)
  assert.equal(p.y, 1)
  assert.ok(Math.abs(p.x - 8 / 40) < 0.03, `pivot x ${p.x}`)
})

test('detectInRows honors a cut that falls on an empty column inside a merge gap', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 60, h = 30
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 20)
  square(buf, w, 27, 5, 20) // 2 px gap, merged with mergeGap 3
  const rows = detectInRows(buf, w, h, { rows: [[0, 30]], cuts: [[26]], maskAlpha: 128, minArea: 50, mergeGap: 3 })
  assert.deepEqual(rows[0].map((r) => [r.x, r.w]), [[5, 20], [27, 20]])
})

test('generated atlases have clean alpha and the base animations of every sprite', async () => {
  const { readFileSync } = await import('node:fs')
  const sharp = (await import('sharp')).default
  const root = new URL('../../', import.meta.url)
  const keysOf = (file) =>
    JSON.parse(readFileSync(new URL(`FE/src/data/${file}`, root), 'utf8'))
      .map((d) => d.spriteKey)
      .filter(Boolean)
  for (const [atlas, keys] of [['heroes', keysOf('characters.json')], ['enemies', keysOf('enemies.json')]]) {
    const json = JSON.parse(readFileSync(new URL(`FE/public/assets/atlas/${atlas}.json`, root), 'utf8'))
    const names = Object.keys(json.frames)
    for (const k of keys) {
      assert.ok(names.includes(`${k}_down_idle_0`), `${atlas}: ${k}_down_idle_0`)
      assert.ok(names.some((n) => n.startsWith(`${k}_`) && n.includes('_walk_')), `${atlas}: ${k} walk`)
    }
    const { data, info } = await sharp(fileURLToPath(new URL(`FE/public/assets/atlas/${atlas}.png`, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let faint = 0
    for (let i = 3; i < info.width * info.height * 4; i += 4) if (data[i] > 0 && data[i] < 25) faint++
    assert.equal(faint, 0, `${atlas}: ${faint} faint alpha pixels`)
  }
})

test('detectInRows keeps the soft edge around the solid core', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 60, h = 40
  const buf = rgba(w, h)
  // soft outline (alpha 100) one pixel wide around a solid 20x20 core
  for (let y = 9; y <= 30; y++) for (let x = 9; x <= 30; x++) setPx(buf, w, x, y, [200, 50, 50, 100])
  square(buf, w, 10, 10, 20)
  const rows = detectInRows(buf, w, h, { rows: [[0, 40]], maskAlpha: 180, edgeAlpha: 25, minArea: 50 })
  assert.deepEqual(rows[0][0], { x: 9, y: 9, w: 22, h: 22 })
})

test('soft edge growth stops halfway to the neighbouring frame', async () => {
  const { detectInRows } = await import('./detect.mjs')
  const w = 70, h = 30
  const buf = rgba(w, h)
  square(buf, w, 5, 5, 20)
  square(buf, w, 45, 5, 20)
  // faint glow filling the whole gap between the two frames
  for (let x = 25; x < 45; x++) setPx(buf, w, x, 15, [255, 255, 255, 60])
  const rows = detectInRows(buf, w, h, { rows: [[0, 30]], maskAlpha: 180, edgeAlpha: 25, minArea: 50, mergeGap: 2 })
  const [a, b] = rows[0]
  assert.equal(a.x + a.w - 1, 34)
  assert.equal(b.x, 35)
})

test('weapons atlas has base and evolved frames for every weapon, scaled down to game size', async () => {
  const { readFileSync } = await import('node:fs')
  const root = new URL('../../', import.meta.url)
  const ids = JSON.parse(readFileSync(new URL('FE/src/data/weapons.json', root), 'utf8')).map((w) => w.id)
  const json = JSON.parse(readFileSync(new URL('FE/public/assets/atlas/weapons.json', root), 'utf8'))
  const names = Object.keys(json.frames)
  for (const id of [...ids, 'mantis_blades_open']) {
    for (const v of ['base', 'evo']) assert.ok(names.includes(`weapon_${id}_${v}`), `weapon_${id}_${v}`)
  }
  const pistol = json.frames.weapon_pistol_base.frame
  assert.ok(pistol.w >= 24 && pistol.w <= 48, `pistol width ${pistol.w}`)
  const rifle = json.frames.weapon_heavy_rifle_base.frame
  assert.ok(rifle.w > pistol.w * 2.5, `rifle ${rifle.w} vs pistol ${pistol.w}`)
})
