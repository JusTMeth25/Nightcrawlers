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

/** 'unsent_result': an online result still waits to be sent; a new run would make the server abandon it. */
export type StartOutcome = 'started' | 'needs_verification' | 'error' | 'unsent_result'

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
  /** Wait before the automatic retry of a 409 on end (injectable for tests). */
  sleep?(ms: number): Promise<void>
}

/** A 409 on end may be a transient DB lock conflict: retried once after this delay. */
export const END_CONFLICT_RETRY_MS = 1000

/** An online result not yet accepted by the server that can still be sent (retry or new login). */
export function hasUnsentResult(s: Pick<RunState, 'config' | 'result' | 'outcome' | 'canRetry'>): boolean {
  return s.config?.mode === 'online' && s.result !== null && s.outcome === null && s.canRetry
}

function randomSeed() {
  // same range as the server seeds: 0..2147483646
  return crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647
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
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
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
      const runId = config.runId
      try {
        let res: EndRunResponse
        try {
          res = await api.endRun(runId, body)
        } catch (error) {
          // 409 is either a closed run (final) or a lock conflict (transient): retry once
          if (!isApiError(error, 409)) throw error
          await sleep(END_CONFLICT_RETRY_MS)
          if (get().config !== config) return
          res = await api.endRun(runId, body)
        }
        if (get().config !== config) return
        session.getState().setSave(res.save)
        set({ outcome: res, submitting: false, submitError: null, canRetry: true })
      } catch (error) {
        if (get().config !== config) return
        // 401 means "log in again" only when the session is really gone; otherwise asking to log in
        // would make the game-over screen resend in a loop
        if (isApiError(error, 401) && session.getState().status !== 'authenticated') {
          set({ submitting: false, needsLogin: true, submitError: t('gameOver.loginRequired'), canRetry: true })
        } else if (isApiError(error, 404) || isApiError(error, 409)) {
          // 404, or 409 again after the automatic retry: the server closed the run (abandoned);
          // nothing to retry; refresh the save shown elsewhere
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
        if (hasUnsentResult(get())) return 'unsent_result'
        const s = session.getState()
        if (s.status !== 'authenticated') return get().startGuest()
        // the previous result stays until the new config arrives (the game-over screen keeps showing it)
        set({ startError: null })
        try {
          const res = await api.startRun({ characterId })
          set({
            ...cleared,
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
        if (hasUnsentResult(get())) return 'unsent_result'
        set({ ...cleared, config: guestConfig(characterId) })
        return 'started'
      },

      onCheckpoint(c) {
        const { config, result } = get()
        if (!config || config.mode !== 'online' || !config.runId || result) return
        if (session.getState().status !== 'authenticated') return
        // never blocks the game: network errors and 429 (too frequent) wait for the next checkpoint
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
