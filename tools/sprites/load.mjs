// Loads a source sheet and returns cleaned RGBA pixels.
import sharp from 'sharp'
import { chromaBlack, cleanAlpha } from './clean.mjs'

/** @returns {Promise<{ rgba: Buffer, w: number, h: number }>} */
export async function loadSheet(path, mode, options = {}) {
  const img = sharp(path)
  const { width: w, height: h } = await img.metadata()
  if (mode === 'chroma') {
    const rgb = await img.removeAlpha().raw().toBuffer()
    // feathered edges below the halo threshold are dropped like on alpha sheets
    return { rgba: cleanAlpha(chromaBlack(rgb, w, h, options), w, h, { minAlpha: 25, minLuma: 0 }), w, h }
  }
  const rgba = await img.ensureAlpha().raw().toBuffer()
  return { rgba: cleanAlpha(rgba, w, h, options), w, h }
}
