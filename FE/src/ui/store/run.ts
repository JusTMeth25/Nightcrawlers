import { create } from 'zustand'
import type { CharacterId } from '@shared/types'

export interface RunState {
  characterId: CharacterId | null
  select(id: CharacterId): void
  reset(): void
}

export const useRun = create<RunState>()((set) => ({
  characterId: null,
  select: (characterId) => set({ characterId }),
  reset: () => set({}),
}))
