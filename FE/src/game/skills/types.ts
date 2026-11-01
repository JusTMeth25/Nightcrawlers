// Contracts between the skill system, the skills and the scene.
import type { OwnedWeapon, SkillDef, Stats, WeaponId } from '@shared/types'
import type { InputState } from '../input/InputState'
import type { ScreenFx } from '../fx/ScreenFx'
import type { Vec } from '../weapons/targeting'
import type { CombatHost } from '../weapons/types'

export interface SkillHost extends CombatHost {
  readonly stats: Stats
  /** the character's neon colour (skill VFX) */
  readonly characterColor: number
  readonly screen: ScreenFx
  /** this frame's input */
  readonly inputState: InputState
  /** The owned weapon with this id, if any. */
  inventoryWeapon(id: WeaponId): OwnedWeapon | undefined
  /** Heals the player (psychosis penalty applied). */
  heal(amount: number): void
  /** Aim direction with the `aim` weapon rules (aim, else nearest enemy, else facing). */
  aim(out: Vec): Vec
}

export interface Skill {
  /** `durationSec` is the def duration scaled by the duration stat. */
  activate(host: SkillHost, durationSec: number): void
  /** Every simulation step, also when inactive. */
  update(host: SkillHost, dt: number): void
  /** True while a lasting effect runs. */
  readonly active: boolean
  /** Ends a lasting effect at once (run end, teardown). */
  stop(host: SkillHost): void
  destroy?(): void
}

export type SkillFactory = (def: SkillDef, host: SkillHost) => Skill
