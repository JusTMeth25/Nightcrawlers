// Keyboard + mouse: WASD/arrows move, cursor aims from the player, Space or right click = skill, Esc = pause.
import Phaser from 'phaser'
import { emptyInput, resetInput, type InputState } from './InputState'
import { normalize } from './normalize'

const AIM_IDLE_MS = 3000
const KEYS = 'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC'

type KeyName = 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE' | 'ESC'
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>

export class KeyboardMouseInput {
  readonly state: InputState = emptyInput()
  /** true when keys or mouse were used in the last update */
  used = false
  private readonly scene: Phaser.Scene
  private readonly keys: Keys | null
  private lastMouseX = Number.NaN
  private lastMouseY = Number.NaN
  private lastMouseMoveAt = -Infinity
  private rightWasDown = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // no capture: the React overlay keeps Space and arrows for its own buttons and menus
    this.keys = (scene.input.keyboard?.addKeys(KEYS, false) as Keys | undefined) ?? null
  }

  update(playerScreenX: number, playerScreenY: number, nowMs: number): InputState {
    const s = resetInput(this.state)
    this.used = false
    const k = this.keys
    if (k) {
      const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0)
      const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0)
      const [mx, my] = normalize(x, y)
      s.moveX = mx
      s.moveY = my
      if (x !== 0 || y !== 0) this.used = true
      if (Phaser.Input.Keyboard.JustDown(k.SPACE)) s.skill = true
      if (Phaser.Input.Keyboard.JustDown(k.ESC)) s.pause = true
    }

    const mouse = this.scene.input.mousePointer
    if (mouse) {
      if (mouse.x !== this.lastMouseX || mouse.y !== this.lastMouseY) {
        if (!Number.isNaN(this.lastMouseX)) {
          this.lastMouseMoveAt = nowMs
          this.used = true
        }
        this.lastMouseX = mouse.x
        this.lastMouseY = mouse.y
      }
      const right = mouse.rightButtonDown()
      if (right && !this.rightWasDown) s.skill = true
      this.rightWasDown = right
      const recent = nowMs - this.lastMouseMoveAt <= AIM_IDLE_MS
      if (this.scene.input.isOver && recent) {
        const [ax, ay] = normalize(mouse.x - playerScreenX, mouse.y - playerScreenY)
        if (ax !== 0 || ay !== 0) {
          s.aimX = ax
          s.aimY = ay
          s.aimActive = true
        }
      }
    }
    if (s.skill || s.pause) this.used = true
    return s
  }

  destroy(): void {
    if (!this.keys) return
    for (const key of Object.values(this.keys)) this.scene.input.keyboard?.removeKey(key, true)
  }
}
