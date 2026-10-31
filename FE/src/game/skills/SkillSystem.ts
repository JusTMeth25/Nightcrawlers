// The character's signature skill: cooldown (scaled by the cooldown stat), activation on the skill
// button, and the skill's own update. Plan Task 13.
import type { SkillDef, SkillId, Stats } from '@shared/types'
import { Cooldown, skillCooldown } from './cooldown'
import { createClusterGrenade } from './clusterGrenade'
import { createExplosiveBarrage } from './explosiveBarrage'
import { createHeavyBurst } from './heavyBurst'
import { createQuickhack } from './quickhack'
import { createSandevistan } from './sandevistan'
import { createSnipe } from './snipe'
import { createSupport } from './support'
import { createSuppression } from './suppression'
import type { Skill, SkillFactory, SkillHost } from './types'

const FACTORIES: Record<SkillId, SkillFactory> = {
  sandevistan: createSandevistan,
  quickhack: createQuickhack,
  explosive_barrage: createExplosiveBarrage,
  suppression: createSuppression,
  snipe: createSnipe,
  cluster_grenade: createClusterGrenade,
  heavy_burst: createHeavyBurst,
  support: createSupport,
}

export class SkillSystem {
  readonly def: SkillDef
  private readonly host: SkillHost
  private readonly skill: Skill
  private readonly cooldown: Cooldown

  constructor(host: SkillHost, def: SkillDef) {
    this.host = host
    this.def = def
    this.skill = FACTORIES[def.id](def, host)
    this.cooldown = new Cooldown(skillCooldown(def, host.stats))
  }

  /** The cooldown stat changed (cyberware, cards). */
  setStats(stats: Stats): void {
    this.cooldown.setDuration(skillCooldown(this.def, stats))
  }

  /** `pressed`: the skill button went down this frame. */
  update(dt: number, pressed: boolean): void {
    this.cooldown.tick(dt)
    if (pressed && this.cooldown.trigger()) {
      this.skill.activate(this.host, this.def.durationSec * this.host.stats.duration)
      this.host.player.skillPose()
      this.host.sfx('skill')
    }
    this.skill.update(this.host, dt)
  }

  /** HudState.skillCooldown01: 1 = just used, 0 = ready. */
  get cooldown01(): number {
    return this.cooldown.remaining01
  }

  get active(): boolean {
    return this.skill.active
  }

  stop(): void {
    this.skill.stop(this.host)
  }

  destroy(): void {
    this.skill.stop(this.host)
    this.skill.destroy?.()
  }
}
