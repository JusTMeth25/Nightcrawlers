// Merges keyboard+mouse, touch and gamepad into one InputState per frame.
import type Phaser from 'phaser'
import { emptyInput, type InputSource, type InputState } from './InputState'
import { GamepadInput } from './GamepadInput'
import { KeyboardMouseInput } from './KeyboardMouseInput'
import { mergeInput } from './normalize'
import { TouchInput } from './TouchInput'

export class InputManager {
  readonly kbm: KeyboardMouseInput
  readonly touch: TouchInput
  readonly pad: GamepadInput
  /** the device used most recently: it drives movement and aim */
  last: InputSource = 'kbm'
  private readonly scene: Phaser.Scene
  private readonly out: InputState = emptyInput()
  private readonly sources: (InputState | null)[] = [null, null, null]

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.kbm = new KeyboardMouseInput(scene)
    this.touch = new TouchInput(scene)
    this.pad = new GamepadInput(scene)
    // right click is the skill button, not the browser menu
    scene.input.mouse?.disableContextMenu()
  }

  update(playerScreenX: number, playerScreenY: number, autoAim: boolean): InputState {
    const now = this.scene.game.loop.time
    const kbm = this.kbm.update(playerScreenX, playerScreenY, now)
    const touch = this.touch.update()
    const pad = this.pad.update()
    if (this.kbm.used) this.last = 'kbm'
    if (this.touch.used) this.last = 'touch'
    if (this.pad.used) this.last = 'pad'
    this.sources[0] = kbm
    this.sources[1] = this.touch.enabled ? touch : null
    this.sources[2] = this.pad.connected ? pad : null
    const out = mergeInput(this.sources, this.last, this.out)
    if (autoAim) out.aimActive = false
    return out
  }

  destroy(): void {
    this.kbm.destroy()
    this.touch.destroy()
  }
}
