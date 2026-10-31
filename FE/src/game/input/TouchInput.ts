// Touch: dynamic stick on the left half (move) and on the right half (aim), buttons top right.
// Active from the first touch. The layout is shared with TouchControlsScene, which only draws it.
import type Phaser from 'phaser'
import { emptyInput, resetInput, type InputState } from './InputState'
import { clampLength, normalize } from './normalize'

export const STICK_RADIUS = 60
const BUTTON_RADIUS = 30
const MARGIN = 20

export interface TouchButton {
  id: 'skill' | 'pause'
  x: number
  y: number
  r: number
}

/** Pause in the top right corner, skill just below it. */
export function touchButtons(width: number): TouchButton[] {
  const x = width - MARGIN - BUTTON_RADIUS
  return [
    { id: 'pause', x, y: MARGIN + BUTTON_RADIUS, r: BUTTON_RADIUS },
    { id: 'skill', x, y: MARGIN * 2 + BUTTON_RADIUS * 3, r: BUTTON_RADIUS },
  ]
}

/** The column holding the buttons never starts a stick. */
export function inReservedZone(x: number, y: number, width: number): boolean {
  return x >= width - (MARGIN * 2 + BUTTON_RADIUS * 2) && y <= MARGIN * 3 + BUTTON_RADIUS * 4
}

/** A stick centred where the finger lands; the knob follows up to STICK_RADIUS. */
export class VirtualStick {
  pointerId = -1
  baseX = 0
  baseY = 0
  knobX = 0
  knobY = 0

  get active(): boolean {
    return this.pointerId !== -1
  }

  start(id: number, x: number, y: number): void {
    this.pointerId = id
    this.baseX = this.knobX = x
    this.baseY = this.knobY = y
  }

  move(id: number, x: number, y: number): void {
    if (id !== this.pointerId) return
    const [dx, dy] = clampLength((x - this.baseX) / STICK_RADIUS, (y - this.baseY) / STICK_RADIUS)
    this.knobX = this.baseX + dx * STICK_RADIUS
    this.knobY = this.baseY + dy * STICK_RADIUS
  }

  end(id: number): void {
    if (id === this.pointerId) this.pointerId = -1
  }

  /** Stick vector, length <= 1. */
  vector(): [number, number] {
    if (!this.active) return [0, 0]
    return [(this.knobX - this.baseX) / STICK_RADIUS, (this.knobY - this.baseY) / STICK_RADIUS]
  }
}

export class TouchInput {
  readonly state: InputState = emptyInput()
  readonly move = new VirtualStick()
  readonly aim = new VirtualStick()
  /** becomes true at the first touch and stays true */
  enabled = false
  used = false
  private readonly scene: Phaser.Scene
  private skillQueued = false
  private pauseQueued = false
  private touchedThisFrame = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    scene.input.on('pointerdown', this.onDown, this)
    scene.input.on('pointermove', this.onMove, this)
    scene.input.on('pointerup', this.onUp, this)
    scene.input.on('pointerupoutside', this.onUp, this)
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return
    this.enabled = true
    this.touchedThisFrame = true
    const width = this.scene.scale.width
    for (const b of touchButtons(width)) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.3) {
        if (b.id === 'skill') this.skillQueued = true
        else this.pauseQueued = true
        return
      }
    }
    if (inReservedZone(p.x, p.y, width)) return
    const stick = p.x < width / 2 ? this.move : this.aim
    if (!stick.active) stick.start(p.id, p.x, p.y)
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return
    this.move.move(p.id, p.x, p.y)
    this.aim.move(p.id, p.x, p.y)
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.move.end(p.id)
    this.aim.end(p.id)
  }

  update(): InputState {
    const s = resetInput(this.state)
    const [mx, my] = this.move.vector()
    s.moveX = mx
    s.moveY = my
    const [ax, ay] = this.aim.vector()
    if (this.aim.active && (ax !== 0 || ay !== 0)) {
      const [nx, ny] = normalize(ax, ay)
      s.aimX = nx
      s.aimY = ny
      s.aimActive = true
    }
    s.skill = this.skillQueued
    s.pause = this.pauseQueued
    this.skillQueued = false
    this.pauseQueued = false
    this.used = this.touchedThisFrame || this.move.active || this.aim.active
    this.touchedThisFrame = false
    return s
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this)
    this.scene.input.off('pointermove', this.onMove, this)
    this.scene.input.off('pointerup', this.onUp, this)
    this.scene.input.off('pointerupoutside', this.onUp, this)
  }
}
