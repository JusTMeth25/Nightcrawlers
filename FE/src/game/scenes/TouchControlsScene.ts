// Overlay above RunScene (not zoomed): touch sticks and buttons, plus the FPS/debug line.
// Input logic lives in TouchInput.
import Phaser from 'phaser'
import { STICK_RADIUS, touchButtons, type TouchInput, type VirtualStick } from '../input/TouchInput'

export const TOUCH_SCENE_KEY = 'TouchControls'
const NEON = 0x05d9e8
const NEON_HOT = 0xff2a6d

export class TouchControlsScene extends Phaser.Scene {
  private touch: TouchInput | null = null
  private gfx!: Phaser.GameObjects.Graphics
  private text!: Phaser.GameObjects.Text
  private debug: (() => string | null) | null = null
  private nextTextAt = 0

  constructor() {
    super(TOUCH_SCENE_KEY)
  }

  init(data: { touch: TouchInput; debug?: () => string | null }): void {
    this.touch = data.touch
    this.debug = data.debug ?? null
  }

  create(): void {
    this.gfx = this.add.graphics()
    this.text = this.add.text(8, 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#d1f7ff' }).setAlpha(0.85)
  }

  update(time: number): void {
    if (time >= this.nextTextAt) {
      // 4 Hz is enough for a readable counter and keeps Text re-rendering cheap
      this.nextTextAt = time + 250
      this.text.setText(this.debug?.() ?? '')
    }
    const g = this.gfx
    g.clear()
    const touch = this.touch
    if (!touch || !touch.enabled) return
    this.drawStick(touch.move, NEON)
    this.drawStick(touch.aim, NEON_HOT)
    for (const b of touchButtons(this.scale.width)) {
      g.lineStyle(2, b.id === 'skill' ? NEON_HOT : NEON, 0.8)
      g.fillStyle(0x000000, 0.35)
      g.fillCircle(b.x, b.y, b.r)
      g.strokeCircle(b.x, b.y, b.r)
      if (b.id === 'pause') {
        g.fillStyle(NEON, 0.9)
        g.fillRect(b.x - 8, b.y - 10, 5, 20)
        g.fillRect(b.x + 3, b.y - 10, 5, 20)
      } else {
        g.fillStyle(NEON_HOT, 0.9)
        g.fillTriangle(b.x - 4, b.y - 12, b.x + 6, b.y - 2, b.x - 6, b.y + 12)
      }
    }
  }

  private drawStick(stick: VirtualStick, color: number): void {
    if (!stick.active) return
    const g = this.gfx
    g.lineStyle(2, color, 0.6)
    g.strokeCircle(stick.baseX, stick.baseY, STICK_RADIUS)
    g.fillStyle(color, 0.5)
    g.fillCircle(stick.knobX, stick.knobY, STICK_RADIUS * 0.4)
  }
}
