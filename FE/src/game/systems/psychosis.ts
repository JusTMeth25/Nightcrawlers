// Psychosis meter (spec 2.5): kills with cyberware fill it; at 100 the frenzy starts.
import { balance } from '@data/index'

export interface PsychosisState {
  value: number
  frenzyLeftSec: number
}

const MAX = 100
const EPS = 1e-9

export function createPsychosis(): PsychosisState {
  return { value: 0, frenzyLeftSec: 0 }
}

export function onKill(s: PsychosisState, totalCyberLevels: number): PsychosisState {
  if (isFrenzy(s) || totalCyberLevels <= 0) return s
  const value = s.value + balance.psychosis.perKillPerCyberLevel * totalCyberLevels
  if (value >= MAX - EPS) return { value: 0, frenzyLeftSec: balance.psychosis.frenzyDurationSec }
  return { value, frenzyLeftSec: 0 }
}

export function tick(s: PsychosisState, dtSec: number): PsychosisState {
  if (!isFrenzy(s)) return s
  const left = s.frenzyLeftSec - dtSec
  return { value: s.value, frenzyLeftSec: left > EPS ? left : 0 }
}

export function isFrenzy(s: PsychosisState): boolean {
  return s.frenzyLeftSec > 0
}
