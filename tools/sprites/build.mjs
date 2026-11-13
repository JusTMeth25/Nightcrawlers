// Builds the Phaser atlases (JSON Hash) from the source sheets and overrides.
// Usage: node sprites/build.mjs [heroes|enemies ...]
// Frames: <spriteKey>_<dir>_<action>_<n>; effects: <spriteKey>_fx_<n>.
// Each frame carries a feet pivot, so wide frames (muzzle flash) stay anchored.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import sharp from 'sharp'
import { detectInRows } from './detect.mjs'
import { loadSheet } from './load.mjs'
import { feetPivot, shelfPack } from './pack.mjs'
import { SHEETS } from './sheets.mjs'

function crop(rgba, w, rect) {
  const out = Buffer.alloc(rect.w * rect.h * 4)
  for (let y = 0; y < rect.h; y++) {
    const from = ((rect.y + y) * w + rect.x) * 4
    rgba.copy(out, y * rect.w * 4, from, from + rect.w * 4)
  }
  return out
}

export async function buildSheet(name) {
  const sheet = SHEETS[name]
  const ov = JSON.parse(readFileSync(sheet.overrides, 'utf8'))
  const { rgba, w, h } = await loadSheet(sheet.source, sheet.mode, sheet.clean)
  const rows = detectInRows(rgba, w, h, {
    rows: ov.rows.map((r) => r.band),
    cuts: ov.rows.map((r) => r.cuts ?? []),
    maskAlpha: ov.maskAlpha,
    minArea: ov.minArea,
    mergeGap: ov.mergeGap,
  })

  const frames = []
  const fxCount = {}
  rows.forEach((detected, ri) => {
    const { spriteKey, dir, actions = {}, names } = ov.rows[ri]
    // static images (weapons): one explicit name per detected frame, centered pivot
    names?.forEach((frameName, index) => {
      const rect = detected[index]
      if (!rect) throw new Error(`${name} row ${ri}: no frame ${index} for ${frameName}`)
      frames.push({ name: frameName, rect, pixels: crop(rgba, w, rect), pivot: { x: 0.5, y: 0.5 } })
    })
    for (const [action, indices] of Object.entries(actions)) {
      indices.forEach((index, n) => {
        const rect = detected[index]
        if (!rect) throw new Error(`${name} row ${ri} (${spriteKey}_${dir}): no frame ${index} for ${action}`)
        const pixels = crop(rgba, w, rect)
        const frameName =
          action === 'fx' ? `${spriteKey}_fx_${(fxCount[spriteKey] = (fxCount[spriteKey] ?? -1) + 1)}` : `${spriteKey}_${dir}_${action}_${n}`
        frames.push({ name: frameName, rect, pixels, pivot: action === 'fx' ? { x: 0.5, y: 0.5 } : feetPivot(pixels, rect.w, rect.h, ov.maskAlpha) })
      })
    }
  })

  if (sheet.scale && sheet.scale !== 1) {
    // pixel art stays crisp with nearest-neighbour downscaling
    for (const f of frames) {
      const tw = Math.max(1, Math.round(f.rect.w * sheet.scale))
      const th = Math.max(1, Math.round(f.rect.h * sheet.scale))
      f.pixels = await sharp(f.pixels, { raw: { width: f.rect.w, height: f.rect.h, channels: 4 } })
        .resize(tw, th, { kernel: 'nearest' })
        .raw()
        .toBuffer()
      f.rect = { ...f.rect, w: tw, h: th }
    }
  }

  const { positions, width, height } = shelfPack(frames.map((f) => f.rect), { maxWidth: 2048, padding: 2 })
  const atlas = Buffer.alloc(width * height * 4)
  const json = { frames: {}, meta: { app: 'nightcrawlers-sprites', image: `${name}.png`, format: 'RGBA8888', size: { w: width, h: height }, scale: '1' } }
  frames.forEach((f, i) => {
    const { x, y } = positions[i]
    for (let row = 0; row < f.rect.h; row++) f.pixels.copy(atlas, ((y + row) * width + x) * 4, row * f.rect.w * 4, (row + 1) * f.rect.w * 4)
    json.frames[f.name] = {
      frame: { x, y, w: f.rect.w, h: f.rect.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.rect.w, h: f.rect.h },
      sourceSize: { w: f.rect.w, h: f.rect.h },
      pivot: f.pivot,
    }
  })

  mkdirSync(dirname(sheet.out), { recursive: true })
  await sharp(atlas, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${sheet.out}.png`)
  writeFileSync(`${sheet.out}.json`, JSON.stringify(json, null, 1) + '\n')

  const counts = {}
  for (const f of frames) {
    const key = f.name.replace(/_\d+$/, '')
    counts[key] = (counts[key] ?? 0) + 1
  }
  return { name, width, height, frames: frames.length, counts }
}

if (process.argv[1]?.endsWith('build.mjs')) {
  const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(SHEETS)
  for (const n of names) {
    const r = await buildSheet(n)
    console.log(`${r.name}: ${r.frames} frames, ${r.width}x${r.height}`)
    console.log(Object.entries(r.counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
  }
}
