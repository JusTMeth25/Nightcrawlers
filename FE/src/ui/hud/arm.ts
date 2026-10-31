/** In-game overlays ignore input for this long after opening, so keys/buttons held for the game do nothing. */
export const ARM_DELAY_MS = 300

/** Enter/Space auto-repeat (key held from gameplay) must not activate the focused button. */
export function isRepeatedActivation(e: { repeat: boolean; key: string }) {
  return e.repeat && (e.key === 'Enter' || e.key === ' ')
}
