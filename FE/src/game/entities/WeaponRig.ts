// Draws the owned weapons on the character's body (hand, holsters, shoulder mounts, forearms).
// Positions come from render/weaponSlots; this class only owns the Phaser images.
import Phaser from 'phaser'
import type { OwnedWeapon, WeaponId } from '@shared/types'
import { actorDepth } from '../render/depth'
import {
  assignSlots,
  type BodySlot,
  glowAlpha,
  recoilOffset,
  slotPose,
  WEAPON_SCALE,
  weaponFrame,
} from '../render/weaponSlots'
import type { Vec } from '../weapons/targeting'
import { SPRITE_SCALE } from '../world/view'
import type { Player } from './Player'

const ATLAS = 'weapons'
const POP_SEC = 0.3
const SLASH_SEC = 0.25
/** after a shot the gun keeps pointing where it fired for this long, then follows the aim again */
const HOLD_AIM_SEC = 0.6
const HANDHELD = new Set<WeaponId>(['pistol', 'smart_pistol', 'shotgun', 'heavy_rifle'])

interface Mounted {
  owned: OwnedWeapon
  slot: BodySlot
  image: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Image
  color: number
  sinceShot: number
  popLeft: number
  slashLeft: number
  holdLeft: number
  shotAngle: number
  frame: string
}

export class WeaponRig {
  private readonly mounted: Mounted[] = []
  private lastHandheld: WeaponId | null = null
  private time = 0
  private readonly scene: Phaser.Scene
  private readonly player: Player
  private readonly colors: Partial<Record<WeaponId, number>>

  constructor(scene: Phaser.Scene, player: Player, colors: Partial<Record<WeaponId, number>>) {
    this.scene = scene
    this.player = player
    this.colors = colors
  }

  /** Inventory changed: add, remove or upgrade weapons (a new weapon or level pops). */
  sync(owned: readonly OwnedWeapon[]): void {
    if (!this.scene.textures.exists(ATLAS)) return
    for (let i = this.mounted.length - 1; i >= 0; i--) {
      if (!owned.some((w) => w.id === this.mounted[i].owned.id)) {
        this.mounted[i].image.destroy()
        this.mounted[i].glow.destroy()
        this.mounted.splice(i, 1)
      }
    }
    for (const w of owned) {
      if (w.id === 'drone') continue
      const existing = this.mounted.find((m) => m.owned.id === w.id)
      if (existing) {
        if (existing.owned.level !== w.level || existing.owned.evolved !== w.evolved) existing.popLeft = POP_SEC
        existing.owned = w
        continue
      }
      const frame = weaponFrame(w, false)
      this.mounted.push({
        owned: w,
        slot: 'hand',
        image: this.scene.add.image(0, 0, ATLAS, frame),
        glow: this.scene.add.image(0, 0, ATLAS, frame).setBlendMode('ADD').setAlpha(0),
        color: this.colors[w.id] ?? 0xffffff,
        sinceShot: 1,
        popLeft: POP_SEC,
        slashLeft: 0,
        holdLeft: 0,
        shotAngle: 0,
        frame,
      })
    }
    this.reassign(owned)
  }

  /** A weapon fired: recoil, blades open, the gun swaps into the hand and points at the target. */
  onFire(id: WeaponId, dir: Vec | null): void {
    const m = this.mounted.find((x) => x.owned.id === id)
    if (!m) return
    m.sinceShot = 0
    if (id === 'mantis_blades') m.slashLeft = SLASH_SEC
    if (dir && (dir.x !== 0 || dir.y !== 0)) {
      m.shotAngle = Math.atan2(dir.y, dir.x)
      m.holdLeft = HOLD_AIM_SEC
    }
    if (HANDHELD.has(id) && this.lastHandheld !== id) {
      this.lastHandheld = id
      this.reassign(this.mounted.map((x) => x.owned))
    }
  }

  /** `dt` is game time (0 while paused); `aim` is the player's aim or facing direction. */
  update(dt: number, aimX: number, aimY: number): void {
    this.time += dt
    const p = this.player
    const facing = p.facing
    const flip = p.flipped
    const bodyDepth = actorDepth(p.y, p.y)
    const visible = !p.dead
    const aimAngle = Math.atan2(aimY, aimX)
    for (const m of this.mounted) {
      m.sinceShot += dt
      m.popLeft = Math.max(0, m.popLeft - dt)
      m.slashLeft = Math.max(0, m.slashLeft - dt)
      m.holdLeft = Math.max(0, m.holdLeft - dt)
      const pose = slotPose(m.slot, facing, flip)
      const angle = pose.aims ? (m.holdLeft > 0 ? m.shotAngle : aimAngle) : pose.angle
      const kick = recoilOffset(m.sinceShot)
      const x = p.x + pose.dx - Math.cos(angle) * kick
      const y = p.y + pose.dy - Math.sin(angle) * kick
      const pop = 1 + 0.6 * (m.popLeft / POP_SEC)
      const scale = SPRITE_SCALE * WEAPON_SCALE[m.owned.id] * pose.scale * pop
      // keep guns upright when they point to the left
      const upsideDown = Math.cos(angle) < 0
      const frame = weaponFrame(m.owned, m.slashLeft > 0)
      if (frame !== m.frame) {
        m.frame = frame
        m.image.setFrame(frame)
        m.glow.setFrame(frame)
      }
      const depth = bodyDepth + (pose.behind ? -0.5 : 0.5)
      m.image
        .setPosition(x, y)
        .setRotation(angle)
        .setFlipY(upsideDown)
        .setScale(scale)
        .setDepth(depth)
        .setAlpha(p.sprite.alpha)
        .setVisible(visible)
      // white flash during the first half of the pop (new weapon or level up)
      if (m.popLeft > POP_SEC / 2) m.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
      else m.image.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY)
      const glow = glowAlpha(m.owned.level, m.owned.evolved, this.time)
      m.glow
        .setPosition(x, y)
        .setRotation(angle)
        .setFlipY(upsideDown)
        .setScale(scale * 1.15)
        .setDepth(depth + 0.01)
        .setTint(m.owned.evolved ? 0xff2a6d : m.color)
        .setAlpha(glow * p.sprite.alpha)
        .setVisible(visible && glow > 0)
    }
  }

  destroy(): void {
    for (const m of this.mounted) {
      m.image.destroy()
      m.glow.destroy()
    }
    this.mounted.length = 0
  }

  private reassign(owned: readonly OwnedWeapon[]): void {
    const slots = assignSlots(owned, this.lastHandheld)
    for (const m of this.mounted) m.slot = slots.get(m.owned.id) ?? 'hipL'
  }
}
