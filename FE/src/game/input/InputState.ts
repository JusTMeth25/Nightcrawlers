// Device-independent input for one frame (spec 3.4). The rest of the game reads only this.

export interface InputState {
  /** movement, length <= 1 */
  moveX: number
  moveY: number
  /** aim direction, length <= 1 */
  aimX: number
  aimY: number
  /** false when the player is not aiming: `aim` weapons target the nearest enemy */
  aimActive: boolean
  /** true only in the frame of the press */
  skill: boolean
  /** true only in the frame of the press */
  pause: boolean
}

export type InputSource = 'kbm' | 'touch' | 'pad'

export function emptyInput(): InputState {
  return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, skill: false, pause: false }
}

export function resetInput(s: InputState): InputState {
  s.moveX = 0
  s.moveY = 0
  s.aimX = 0
  s.aimY = 0
  s.aimActive = false
  s.skill = false
  s.pause = false
  return s
}
