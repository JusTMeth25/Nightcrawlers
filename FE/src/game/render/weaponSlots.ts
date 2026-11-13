// Where each owned weapon is drawn on the character's body, and how it looks.
// Pure: positions are offsets in world units from the player's feet (the sprite pivot).
import type { OwnedWeapon, WeaponId } from '@shared/types'

export type Facing = 'down' | 'side' | 'up'
export type BodySlot = 'hand' | 'hipR' | 'hipL' | 'backA' | 'backB' | 'shoulderR' | 'shoulderL' | 'forearm' | 'wrist'

/** Guns held in the hand: only one at a time, the others are holstered. */
const HANDHELD: readonly WeaponId[] = ['pistol', 'smart_pistol', 'shotgun', 'heavy_rifle']
const SIDEARMS: readonly WeaponId[] = ['pistol', 'smart_pistol']
const MOUNTED: Partial<Record<WeaponId, BodySlot>> = {
  minigun: 'shoulderR',
  grenade_launcher: 'shoulderL',
  mantis_blades: 'forearm',
  monowire: 'wrist',
}

/**
 * Slot of every owned weapon. The hand holds the handheld that fired last (or the first owned one);
 * other sidearms go to the hips, long guns cross on the back. Drones are drawn by their behaviour.
 */
export function assignSlots(owned: readonly OwnedWeapon[], lastFiredHandheld: WeaponId | null): Map<WeaponId, BodySlot> {
  const slots = new Map<WeaponId, BodySlot>()
  const handheld = owned.filter((w) => HANDHELD.includes(w.id)).map((w) => w.id)
  const inHand = lastFiredHandheld !== null && handheld.includes(lastFiredHandheld) ? lastFiredHandheld : (handheld[0] ?? null)
  const hips: BodySlot[] = ['hipR', 'hipL']
  const backs: BodySlot[] = ['backA', 'backB']
  for (const id of handheld) {
    if (id === inHand) slots.set(id, 'hand')
    else if (SIDEARMS.includes(id)) slots.set(id, hips.shift() ?? 'backB')
    else slots.set(id, backs.shift() ?? 'hipL')
  }
  for (const w of owned) {
    const mount = MOUNTED[w.id]
    if (mount) slots.set(w.id, mount)
  }
  return slots
}

export interface SlotPose {
  dx: number
  dy: number
  /** drawn behind the body sprite */
  behind: boolean
  /** turns towards the aim / target; otherwise uses `angle` */
  aims: boolean
  /** resting angle in radians (0 = pointing right) */
  angle: number
  /** extra scale (holstered weapons are a bit smaller) */
  scale: number
}

type PoseTable = Record<Facing, Omit<SlotPose, 'aims' | 'scale'>>

const P = (dx: number, dy: number, behind: boolean, angle = 0) => ({ dx, dy, behind, angle })
const HALF_PI = Math.PI / 2

// Offsets fit a ~44 world-unit tall chibi body (atlas frames drawn at SPRITE_SCALE).
const POSES: Record<BodySlot, { aims: boolean; scale: number; table: PoseTable }> = {
  hand: { aims: true, scale: 1, table: { down: P(9, -15, false), side: P(11, -16, false), up: P(9, -17, true) } },
  hipR: { aims: false, scale: 0.85, table: { down: P(-9, -12, false, HALF_PI), side: P(-3, -13, false, HALF_PI), up: P(9, -12, false, HALF_PI) } },
  hipL: { aims: false, scale: 0.85, table: { down: P(4, -11, false, HALF_PI), side: P(2, -12, true, HALF_PI), up: P(-9, -12, false, HALF_PI) } },
  backA: { aims: false, scale: 0.85, table: { down: P(-3, -24, true, -0.6), side: P(-7, -24, true, -0.9), up: P(3, -24, false, 0.6) } },
  backB: { aims: false, scale: 0.85, table: { down: P(3, -24, true, 0.6), side: P(-5, -22, true, -0.5), up: P(-3, -24, false, -0.6) } },
  shoulderR: { aims: true, scale: 1, table: { down: P(15, -26, false), side: P(3, -31, false), up: P(15, -26, false) } },
  shoulderL: { aims: true, scale: 1, table: { down: P(-15, -26, false), side: P(-4, -30, true), up: P(-15, -26, false) } },
  forearm: { aims: false, scale: 1, table: { down: P(12, -14, false, 1.2), side: P(9, -15, false, 0.3), up: P(12, -15, true, -1.2) } },
  wrist: { aims: false, scale: 1, table: { down: P(-11, -14, false), side: P(-2, -14, true), up: P(-11, -15, true) } },
}

/** Pose of a slot for the facing; `flip` mirrors it when the character faces left. */
export function slotPose(slot: BodySlot, facing: Facing, flip: boolean): SlotPose {
  const { aims, scale, table } = POSES[slot]
  const p = table[facing]
  return {
    dx: flip ? -p.dx : p.dx,
    dy: p.dy,
    behind: p.behind,
    aims,
    angle: flip ? Math.PI - p.angle : p.angle,
    scale,
  }
}

/** Display size of each weapon sprite relative to the character sprite scale. */
export const WEAPON_SCALE: Record<WeaponId, number> = {
  pistol: 1,
  smart_pistol: 0.9,
  shotgun: 0.8,
  heavy_rifle: 0.6,
  minigun: 0.45,
  grenade_launcher: 0.45,
  mantis_blades: 0.6,
  monowire: 0.35,
  drone: 0.6,
}

/** Atlas frame: evolved art once evolved; mantis blades open while slashing. */
export function weaponFrame(w: OwnedWeapon, slashing: boolean): string {
  const id = w.id === 'mantis_blades' && slashing ? 'mantis_blades_open' : w.id
  return `weapon_${id}_${w.evolved ? 'evo' : 'base'}`
}

const TAU = Math.PI * 2

/** Neon glow of the weapon: none up to level 3, brighter to level 7, pulsing at 8 and when evolved. */
export function glowAlpha(level: number, evolved: boolean, timeSec: number): number {
  const pulse = Math.sin(timeSec * TAU * 1.5)
  if (evolved) return 0.6 + 0.2 * pulse
  if (level >= 8) return 0.4 + 0.15 * pulse
  if (level >= 4) return 0.15 + 0.05 * (level - 4)
  return 0
}

const RECOIL_SEC = 0.12
const RECOIL_PX = 3

/** Backward kick (world units) `sinceShot` seconds after firing. */
export function recoilOffset(sinceShot: number): number {
  return sinceShot < RECOIL_SEC ? RECOIL_PX * (1 - sinceShot / RECOIL_SEC) : 0
}
