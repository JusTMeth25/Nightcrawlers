// The player: movement, facing, animations, i-frames with blinking, regeneration and revivals.
// x,y are the feet; the collision circle sits BODY_OFFSET above them.
import Phaser from 'phaser'
import { balance } from '@data/index'
import type { CharacterDef, Stats } from '@shared/types'
import { damageTaken } from '../systems/combat'
import type { InputState } from '../input/InputState'
import type { Dir } from '../render/animations'
import { animTable, dirOf, type AnimTable } from '../render/animTable'
import { drawPlaceholder } from '../render/placeholders'
import { BODY_OFFSET, SPRITE_SCALE } from '../world/view'

const REVIVE_INVULN_SEC = 2
const BLINK_HZ = 16

export type HurtResult = 'none' | 'hit' | 'revived' | 'dead'

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite
  x = 0
  y = 0
  hp: number
  maxHp: number
  /** last non-zero movement direction, used by `aim` weapons with no target */
  faceX = 1
  faceY = 0
  moving = false
  dead = false
  revivals: number
  private stats: Stats
  private invulnLeft = 0
  private dir: Dir = 'down'
  private readonly anims: AnimTable | null

  constructor(scene: Phaser.Scene, character: CharacterDef, stats: Stats, available: Set<string>) {
    this.stats = stats
    this.maxHp = stats.maxHp
    this.hp = stats.maxHp
    this.revivals = Math.floor(stats.revival)
    this.anims = animTable(available, character.spriteKey)
    if (this.anims) {
      this.sprite = scene.add.sprite(0, 0, 'heroes').setScale(SPRITE_SCALE)
      this.play('idle')
    } else {
      this.sprite = scene.add.sprite(0, 0, drawPlaceholder(scene, character.id, character.color, 36, 'hero'))
    }
  }

  get bodyY(): number {
    return this.y - BODY_OFFSET
  }

  get invulnerable(): boolean {
    return this.invulnLeft > 0
  }

  /** New stats after a cyberware card: max HP changes keep the missing HP. */
  setStats(stats: Stats): void {
    const missing = this.maxHp - this.hp
    this.stats = stats
    this.maxHp = stats.maxHp
    this.hp = Math.max(1, Math.min(this.maxHp, this.maxHp - missing))
  }

  update(dt: number, input: InputState, inverted: boolean): void {
    if (this.dead) return
    const sign = inverted ? -1 : 1
    const mx = input.moveX * sign
    const my = input.moveY * sign
    this.moving = mx !== 0 || my !== 0
    if (this.moving) {
      this.x += mx * this.stats.speed * dt
      this.y += my * this.stats.speed * dt
      const len = Math.hypot(mx, my)
      this.faceX = mx / len
      this.faceY = my / len
    }
    // face the aim when aiming, otherwise the movement
    const fx = input.aimActive ? input.aimX : this.faceX
    const fy = input.aimActive ? input.aimY : this.faceY
    this.dir = dirOf(fx, fy)
    this.sprite.setFlipX(this.dir === 'side' && fx < 0)
    this.play(this.moving ? 'walk' : 'idle')

    if (this.stats.regen > 0) this.heal(this.stats.regen * dt)
    if (this.invulnLeft > 0) {
      this.invulnLeft = Math.max(0, this.invulnLeft - dt)
      this.sprite.setAlpha(this.invulnLeft > 0 && Math.floor(this.invulnLeft * BLINK_HZ) % 2 === 0 ? 0.35 : 1)
    }
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setDepth(this.y)
  }

  heal(amount: number): void {
    if (this.dead) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  hurt(raw: number): HurtResult {
    if (this.dead || this.invulnLeft > 0) return 'none'
    this.hp -= damageTaken(raw, this.stats.armor)
    this.invulnLeft = balance.player.invulnerabilitySec
    if (this.hp > 0) return 'hit'
    if (this.revivals > 0) {
      this.revivals--
      this.hp = this.maxHp * 0.5
      this.invulnLeft = REVIVE_INVULN_SEC
      return 'revived'
    }
    this.hp = 0
    this.dead = true
    this.sprite.setAlpha(1)
    this.play('death')
    return 'dead'
  }

  private play(action: 'idle' | 'walk' | 'death'): void {
    const key = this.anims?.[this.dir][action]
    if (key && this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key)
  }

  destroy(): void {
    this.sprite.destroy()
  }
}
