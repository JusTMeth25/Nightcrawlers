// Pixel cleanup for AI-generated sprite sheets.

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Removes the semi-transparent halos around sprites (RGBA in, RGBA out).
 * alpha < minAlpha -> 0; dark pixels (luma < minLuma) with alpha < 200 -> 0.
 */
export function cleanAlpha(rgba, w, h, { minAlpha = 25, minLuma = 18 } = {}) {
  const out = Buffer.from(rgba)
  for (let i = 0; i < w * h * 4; i += 4) {
    const a = out[i + 3]
    if (a < minAlpha || (a < 200 && luma(out[i], out[i + 1], out[i + 2]) < minLuma)) out[i + 3] = 0
  }
  return out
}

/**
 * Keys out a black background (RGB in, RGBA out).
 * luma <= threshold -> transparent; up to threshold + feather -> linear alpha.
 */
export function chromaBlack(rgb, w, h, { threshold = 22, feather = 10 } = {}) {
  const out = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2]
    const l = luma(r, g, b)
    const a = l <= threshold ? 0 : l >= threshold + feather ? 255 : Math.round(((l - threshold) / feather) * 255)
    out.set([r, g, b, a], p * 4)
  }
  return out
}
