import { create } from 'zustand'
import { getCharacter } from '@data'
import type { EndRunResponse } from '@shared/api-contract'
import type { CharacterId, EnemyId, GameOptions, RunCheckpoint, RunConfig, RunResult, WeaponId } from '@shared/types'
import { api as defaultApi, type ApiClient } from '../../api'
import { isApiError } from '../../api/errors'
import { apiErrorText } from '../i18n/apiErrorText'
import { t } from '../i18n/it'
import { useOptions } from './options'
import { useSession, type SessionState } from './session'

export type StartOutcome = 'started' | 'needs_verification' | 'error'

export interface RunState {
  characterId: CharacterId | null
  config: RunConfig | null
  /** Last finished run; kept in memory until the next start so a failed submit can be retried. */
  result: RunResult | null
  outcome: EndRunResponse | null
  submitting: boolean
  submitError: string | null
  /** false when retrying cannot help (the server already closed the run). */
  canRetry: boolean
  /** The session expired before the result was sent: log in again, then retrySubmit. */
  needsLogin: boolean
  startError: string | null
  /** Enemies and weapons met in guest runs (memory only) for the Codex. */
  guestCodex: { enemies: EnemyId[]; weapons: WeaponId[] }
  select(id: CharacterId): void
  start(): Promise<StartOutcome>
  /** Guest run with the selected starter, also for a logged-in user whose email is not verified. */
  startGuest(): StartOutcome
  onCheckpoint(c: RunCheckpoint): void
  finish(r: RunResult): Promise<void>
  retrySubmit(): Promise<void>
  reset(): void
}

export interface RunDeps {
  api: ApiClient
  session: { getState(): SessionState }
  getOptions(): GameOptions
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
}

const cleared = {
  config: null,
  result: null,
  outcome: null,
  submitting: false,
  submitError: null,
  canRetry: true,
  needsLogin: false,
  startError: null,
}

export function createRunStore(deps: RunDeps) {
  const { api, session } = deps
  let submitting: Promise<void> | null = null

  return create<RunState>()((set, get) => {
    function guestConfig(characterId: CharacterId): RunConfig {
      return { mode: 'guest', runId: null, seed: randomSeed(), characterId, ripperdoc: {}, options: deps.getOptions() }
    }

    async function submit(): Promise<void> {
      const { config, result, outcome } = get()
      if (!config || config.mode !== 'online' || !config.runId || !result || outcome) return
      if (session.getState().status !== 'authenticated') {
        set({ needsLogin: true, submitError: t('gameOver.loginRequired'), canRetry: true })
        return
      }
      set({ submitting: true, submitError: null, needsLogin: false })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { runId: _ignored, ...body } = result
      try {
        const res = await api.endRun(config.runId, body)
        if (get().config !== config) return
        session.getState().setSave(res.save)
        set({ outcome: res, submitting: false, submitError: null, canRetry: true })
      } catch (error) {
        if (get().config !== config) return
        if (isApiError(error, 401)) {
          set({ submitting: false, needsLogin: true, submitError: t('gameOver.loginRequired'), canRetry: true })
        } else if (isApiError(error, 404) || isApiError(error, 409)) {
          // the run is no longer ACTIVE on the server: nothing to retry; refresh the save shown elsewhere
          set({ submitting: false, submitError: t('gameOver.runClosed'), canRetry: false })
          void session.getState().reloadSave().catch(() => {})
        } else {
          set({
            submitting: false,
            submitError: t('gameOver.submitFailed', { reason: apiErrorText(error) }),
            canRetry: true,
          })
        }
      }
    }

    function submitOnce() {
      if (!submitting) submitting = submit().finally(() => (submitting = null))
      return submitting
    }

    return {
      characterId: null,
      ...cleared,
      guestCodex: { enemies: [], weapons: [] },

      select: (characterId) => set({ characterId }),

      async start() {
        const characterId = get().characterId
        if (!characterId) return 'error'
        set({ ...cleared })
        const s = session.getState()
        if (s.status !== 'authenticated') return get().startGuest()
        try {
          const res = await api.startRun({ characterId })
          set({
            config: {
              mode: 'online',
              runId: res.runId,
              seed: res.seed,
              characterId,
              ripperdoc: { ...(session.getState().save?.ripperdoc ?? {}) },
              options: deps.getOptions(),
            },
          })
          return 'started'
        } catch (error) {
          if (isApiError(error, 403)) return 'needs_verification'
          set({ startError: apiErrorText(error) })
          return 'error'
        }
      },

      startGuest() {
        const characterId = get().characterId
        if (!characterId || !getCharacter(characterId).starter) return 'error'
        set({ ...cleared, config: guestConfig(characterId) })
        return 'started'
      },

      onCheckpoint(c) {
        const { config, result } = get()
        if (!config || config.mode !== 'online' || !config.runId || result) return
        if (session.getState().status !== 'authenticated') return
        // never blocks the game: network errors wait for the next checkpoint
        api.checkpoint(config.runId, c).catch((error: unknown) => {
          if (isApiError(error, 422)) console.warn('[run] checkpoint rejected: the server flagged the run')
        })
      },

      async finish(r) {
        const { config, result } = get()
        if (!config || result) return // one result per run (onEnd may fire twice)
        set({ result: { ...r, runId: config.runId } })
        if (config.mode === 'guest') {
          const codex = get().guestCodex
          set({
            guestCodex: {
              enemies: [...new Set([...codex.enemies, ...r.enemiesSeen])],
              weapons: [...new Set([...codex.weapons, ...r.weaponsSeen])],
            },
          })
          return
        }
        await submitOnce()
      },

      async retrySubmit() {
        if (!get().canRetry) return
        await submitOnce()
      },

      reset: () => set({ ...cleared }),
    }
  })
}

export const useRun = createRunStore({
  api: defaultApi,
  session: useSession,
  getOptions: () => useOptions.getState().options,
})
