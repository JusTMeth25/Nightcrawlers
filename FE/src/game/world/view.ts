// World scale shared by scene and entities. Positions are the entities' feet (atlas pivot).

/** Atlas sprites are drawn at half size so a character is ~45 world units tall. */
export const SPRITE_SCALE = 0.5
/** Collision circles sit this far above the feet (body centre). */
export const BODY_OFFSET = 18
export const PLAYER_RADIUS = 10
export const ENEMY_RADIUS = 11
export const GRID_CELL = 64

/** The world area every screen shows, whatever its resolution (spec 3.5). */
const VIEW_AREA = 960 * 540

export function computeZoom(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1
  return Math.min(3, Math.max(0.5, Math.sqrt((width * height) / VIEW_AREA)))
}
