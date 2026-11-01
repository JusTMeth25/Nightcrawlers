// Generates the PNG icons from FE/public/favicon.svg.
// Usage: node icons/build.mjs
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pub = (f) => fileURLToPath(new URL(`../../FE/public/${f}`, import.meta.url))
const BACKGROUND = '#05010d'

const svg = pub('favicon.svg')
const plain = [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]

for (const [file, size] of plain) {
  await sharp(svg, { density: 72 * (size / 64) * 2 }).resize(size, size).png({ compressionLevel: 9 }).toFile(pub(file))
  console.log(`${file} ${size}x${size}`)
}

// Maskable: launchers crop to a circle or squircle, so the eye sits inside the 80% safe zone.
const inner = Math.round(512 * 0.72)
const eye = await sharp(svg, { density: 72 * (inner / 64) * 2 }).resize(inner, inner).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: BACKGROUND } })
  .composite([{ input: eye, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(pub('icon-maskable-512.png'))
console.log('icon-maskable-512.png 512x512')
