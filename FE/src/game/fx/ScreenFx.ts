// Camera shake and full-screen flash on game time (see cameraFx.ts): frozen while paused.
import type Phaser from 'phaser'
import { LAYER, layerDepth } from '../render/depth'
import type { Rng } from '../systems/rng'
import { FlashState, ShakeState } from './cameraFx'

export class ScreenFx {
  private readonly shakeState: ShakeState
  private readonly flashState = new FlashState()
  private readonly overlay: Phaser.GameObjects.Rectangle
  private readonly cam: Phaser.Cameras.Scene2D.Camera
  /** screen shake option */
  shakeEnabled = true

  constructor(scene: Phaser.Scene, cosmeticRng: Rng) {
    this.shakeState = new ShakeState(cosmeticRng)
    this.cam = scene.cameras.main
    this.overlay = scene.add
      .rectangle(0, 0, 4, 4, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(layerDepth(LAYER.text) + 1000)
      .setVisible(false)
  }

  shake(durationSec: number, intensity: number): void {
    if (this.shakeEnabled) this.shakeState.start(durationSec, intensity)
  }

  flash(durationSec: number, color: number): void {
    this.flashState.start(durationSec, color)
  }

  /** Called from the simulation step only, so pause freezes it. */
  update(dt: number): void {
    const s = this.shakeState
    s.update(dt)
    this.cam.setFollowOffset(-s.x, -s.y)
    const f = this.flashState
    f.update(dt)
    const a = f.alpha
    if (a <= 0) {
      if (this.overlay.visible) this.overlay.setVisible(false)
      return
    }
    // scroll factor 0 objects still zoom around the screen centre: oversize to cover any zoom
    const w = this.cam.width
    const h = this.cam.height
    this.overlay
      .setPosition(w / 2, h / 2)
      .setSize(w * 3, h * 3)
      .setFillStyle(f.color, a * 0.6)
      .setVisible(true)
  }

  destroy(): void {
    this.overlay.destroy()
  }
}
