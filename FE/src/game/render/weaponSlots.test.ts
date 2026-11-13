import { describe, expect, it } from 'vitest'
import type { OwnedWeapon, WeaponId } from '@shared/types'
import { assignSlots, glowAlpha, recoilOffset, slotPose, weaponFrame } from './weaponSlots'

const w = (id: WeaponId, level = 1, evolved = false): OwnedWeapon => ({ id, level, evolved })

describe('assignSlots', () => {
  it('puts the starting handheld in hand when nothing fired yet', () => {
    const slots = assignSlots([w('shotgun'), w('pistol')], null)
    expect(slots.get('shotgun')).toBe('hand')
    expect(slots.get('pistol')).toBe('hipR')
  })

  it('moves the last fired handheld to the hand and holsters the others', () => {
    const slots = assignSlots([w('pistol'), w('shotgun'), w('heavy_rifle'), w('smart_pistol')], 'heavy_rifle')
    expect(slots.get('heavy_rifle')).toBe('hand')
    expect(slots.get('pistol')).toBe('hipR')
    expect(slots.get('smart_pistol')).toBe('hipL')
    expect(slots.get('shotgun')).toBe('backA')
  })

  it('crosses two long guns on the back', () => {
    const slots = assignSlots([w('pistol'), w('shotgun'), w('heavy_rifle')], 'pistol')
    expect([slots.get('shotgun'), slots.get('heavy_rifle')]).toEqual(['backA', 'backB'])
  })

  it('mounts heavy weapons and cyberware on fixed body slots', () => {
    const slots = assignSlots([w('monowire'), w('minigun'), w('grenade_launcher'), w('mantis_blades'), w('drone')], null)
    expect(slots.get('minigun')).toBe('shoulderR')
    expect(slots.get('grenade_launcher')).toBe('shoulderL')
    expect(slots.get('mantis_blades')).toBe('forearm')
    expect(slots.get('monowire')).toBe('wrist')
    // drones fly on their own: the weapon behaviour draws them
    expect(slots.has('drone')).toBe(false)
  })

  it('ignores a last fired weapon that is no longer owned or not handheld', () => {
    expect(assignSlots([w('pistol')], 'shotgun').get('pistol')).toBe('hand')
    expect(assignSlots([w('pistol'), w('minigun')], 'minigun').get('pistol')).toBe('hand')
  })
})

describe('slotPose', () => {
  it('mirrors horizontal offsets when facing left', () => {
    const right = slotPose('hand', 'side', false)
    const left = slotPose('hand', 'side', true)
    expect(left.dx).toBe(-right.dx)
    expect(left.dy).toBe(right.dy)
  })

  it('draws the hand weapon behind the body when facing up and in front otherwise', () => {
    expect(slotPose('hand', 'up', false).behind).toBe(true)
    expect(slotPose('hand', 'down', false).behind).toBe(false)
    expect(slotPose('hand', 'side', false).behind).toBe(false)
  })

  it('shows back-mounted guns in front only when the back faces the camera', () => {
    expect(slotPose('backA', 'up', false).behind).toBe(false)
    expect(slotPose('backA', 'down', false).behind).toBe(true)
  })

  it('aims hand and shoulder weapons, keeps holsters fixed', () => {
    expect(slotPose('hand', 'down', false).aims).toBe(true)
    expect(slotPose('shoulderR', 'down', false).aims).toBe(true)
    expect(slotPose('hipR', 'down', false).aims).toBe(false)
    expect(slotPose('backA', 'down', false).aims).toBe(false)
  })

  it('places every slot above the feet (negative dy)', () => {
    for (const slot of ['hand', 'hipR', 'hipL', 'backA', 'backB', 'shoulderR', 'shoulderL', 'forearm', 'wrist'] as const) {
      for (const dir of ['down', 'side', 'up'] as const) expect(slotPose(slot, dir, false).dy).toBeLessThan(0)
    }
  })
})

describe('weaponFrame', () => {
  it('uses the evolved sprite once evolved and the open blades while slashing', () => {
    expect(weaponFrame(w('pistol'), false)).toBe('weapon_pistol_base')
    expect(weaponFrame(w('pistol', 8, true), false)).toBe('weapon_pistol_evo')
    expect(weaponFrame(w('mantis_blades', 3), true)).toBe('weapon_mantis_blades_open_base')
    expect(weaponFrame(w('mantis_blades', 8, true), false)).toBe('weapon_mantis_blades_evo')
  })
})

describe('glowAlpha', () => {
  it('grows with level and peaks when evolved', () => {
    expect(glowAlpha(1, false, 0)).toBe(0)
    expect(glowAlpha(3, false, 0)).toBe(0)
    expect(glowAlpha(4, false, 0)).toBeGreaterThan(0)
    const l8 = [0, 0.25, 0.5].map((t) => glowAlpha(8, false, t))
    expect(new Set(l8).size).toBeGreaterThan(1) // level 8 pulses
    expect(Math.min(...[0, 0.25, 0.5].map((t) => glowAlpha(8, true, t)))).toBeGreaterThan(glowAlpha(5, false, 0))
  })
})

describe('recoilOffset', () => {
  it('kicks back right after a shot and settles', () => {
    expect(recoilOffset(0)).toBeGreaterThan(0)
    expect(recoilOffset(0.05)).toBeLessThan(recoilOffset(0))
    expect(recoilOffset(0.2)).toBe(0)
  })
})
