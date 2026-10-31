// Gamepad: left stick moves, right stick aims (deadzone 0.25), A (0) or RB (5) = skill, Start (9) = pause.
// Plugging or unplugging a pad mid-run is safe: the first connected pad is looked up every frame.
import type Phaser from 'phaser'
import { emptyInput, resetInput, type InputState } from './InputState'
import { applyDeadzone, normalize } from './normalize'

const SKILL_BUTTONS = [0, 5]
const PAUSE_BUTTON = 9

export class GamepadInput {
  readonly state: InputState = emptyInput()
  used = false
  connected = false
  private readonly scene: Phaser.Scene
  private skillWasDown = false
  private pauseWasDown = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const plugin = this.scene.input.gamepad
    if (!plugin || plugin.total === 0) return null
    for (const p of plugin.gamepads) if (p && p.connected) return p
    return null
  }

  update(): InputState {
    const s = resetInput(this.state)
    this.used = false
    const pad = this.pad()
    this.connected = pad !== null
    if (!pad) {
      this.skillWasDown = false
      this.pauseWasDown = false
      return s
    }
    const [mx, my] = applyDeadzone(pad.leftStick.x, pad.leftStick.y)
    s.moveX = mx
    s.moveY = my
    const [ax, ay] = applyDeadzone(pad.rightStick.x, pad.rightStick.y)
    if (ax !== 0 || ay !== 0) {
      const [nx, ny] = normalize(ax, ay)
      s.aimX = nx
      s.aimY = ny
      s.aimActive = true
    }
    const pressed = (i: number) => pad.buttons[i]?.pressed === true
    const skill = SKILL_BUTTONS.some(pressed)
    const pause = pressed(PAUSE_BUTTON)
    s.skill = skill && !this.skillWasDown
    s.pause = pause && !this.pauseWasDown
    this.skillWasDown = skill
    this.pauseWasDown = pause
    this.used = mx !== 0 || my !== 0 || s.aimActive || skill || pause
    return s
  }
}
