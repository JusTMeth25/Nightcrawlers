// Renders detected frame boxes over a sheet, to write and check the overrides.
// Usage: node sprites/debug.mjs <heroes|enemies> [outFile]
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { detectInRows } from './detect.mjs'
import { loadSheet } from './load.mjs'
import { SHEETS } from './sheets.mjs'

const name = process.argv[2]
const sheet = SHEETS[name]
if (!sheet) throw new Error('Usage: debug.mjs <heroes|enemies> [outFile]')
const outFile = process.argv[3] ?? `debug-${name}.png`
const ov = JSON.parse(readFileSync(sheet.overrides, 'utf8'))

const { rgba, w, h } = await loadSheet(sheet.source, sheet.mode, sheet.clean)
const rows = detectInRows(rgba, w, h, { rows: ov.rows.map((r) => r.band), cuts: ov.rows.map((r) => r.cuts ?? []), maskAlpha: ov.maskAlpha, minArea: ov.minArea, mergeGap: ov.mergeGap })
const shapes = []
rows.forEach((frames, ri) => {
  const [y0, y1] = ov.rows[ri].band
  shapes.push(`<line x1="0" y1="${y0}" x2="${w}" y2="${y0}" stroke="red" stroke-dasharray="4"/>`, `<line x1="0" y1="${y1}" x2="${w}" y2="${y1}" stroke="red" stroke-dasharray="4"/>`)
  frames.forEach((f, i) => {
    shapes.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="lime"/>`, `<text x="${f.x + 1}" y="${f.y + 10}" font-size="10" fill="yellow">${i}</text>`)
  })
  console.log(`row ${ri} ${ov.rows[ri].spriteKey}_${ov.rows[ri].dir}: ${frames.map((f, i) => `${i}:${f.x}-${f.x + f.w - 1}`).join(' ')}`)
})
const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${shapes.join('')}</svg>`
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  .flatten({ background: '#202020' })
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(outFile)
console.log(`wrote ${outFile}`)
