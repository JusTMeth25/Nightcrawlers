// XP curve and level gain. Several levels can be gained by one pickup: the caller queues them.
import { balance, type Balance } from '@data/index'

export function xpToNext(level: number, xp: Balance['xp'] = balance.xp): number {
  return Math.round(xp.firstLevel * xp.growth ** (level - 1) + xp.flatPerLevel * (level - 1))
}

export function addXp(
  state: { level: number; xp: number },
  amount: number,
  growth: number,
): { level: number; xp: number; levelsGained: number } {
  let level = state.level
  let xp = state.xp + amount * growth
  let levelsGained = 0
  for (let need = xpToNext(level); xp >= need; need = xpToNext(level)) {
    xp -= need
    level++
    levelsGained++
  }
  return { level, xp, levelsGained }
}
