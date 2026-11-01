import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OPTIONS, type RunResult } from '@shared/types'
import type { ApiClient } from '../../api/ApiClient'
import { createAuthBridge } from '../../api/auth'
import { ApiError, problemError } from '../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD, MockApi, UNVERIFIED_LOGIN } from '../../api/mock/MockApi'
import { createRunStore, hasUnsentResult } from './run'
import { createSessionStore } from './session'

function setup() {
  const auth = createAuthBridge()
  const api = new MockApi({ auth, latencyMs: 0, log: () => {} })
  const session = createSessionStore({ api: api as ApiClient, auth })
  const sleep = vi.fn((ms: number) => Promise.resolve(ms).then(() => {}))
  const run = createRunStore({ api, session, getOptions: () => ({ ...DEFAULT_OPTIONS, autoAim: true }), sleep })
  return { auth, api, session, run, sleep }
}

function result(runId: string | null): RunResult {
  return {
    runId,
    characterId: 'david',
    durationSec: 125,
    kills: 40,
    killsByEnemy: { maelstrom: 40 },
    level: 6,
    eurodollarsCollected: 90,
    weaponsSeen: ['pistol', 'shotgun'],
    enemiesSeen: ['maelstrom'],
  }
}

const network = () => new ApiError(0, null, null)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('run store', () => {
  it('guest: guest config without any API call', async () => {
    const { api, session, run } = setup()
    session.getState().playAsGuest()
    const startRun = vi.spyOn(api, 'startRun')
    run.getState().select('lucy')
    expect(await run.getState().start()).toBe('started')
    const config = run.getState().config!
    expect(config).toMatchObject({ mode: 'guest', runId: null, characterId: 'lucy', ripperdoc: {} })
    expect(config.options.autoAim).toBe(true)
    expect(Number.isInteger(config.seed)).toBe(true)
    expect(startRun).not.toHaveBeenCalled()
  })

  it('online: calls startRun and puts runId, seed and the Ripperdoc ranks in the config', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    const startRun = vi.spyOn(api, 'startRun')
    run.getState().select('david')
    expect(await run.getState().start()).toBe('started')
    expect(startRun).toHaveBeenCalledWith({ characterId: 'david' })
    const res = await startRun.mock.results[0].value
    expect(run.getState().config).toMatchObject({
      mode: 'online',
      runId: res.runId,
      seed: res.seed,
      ripperdoc: { max_hp: 1, might: 2 },
    })
  })

  it('startRun 403 (email not verified) answers needs_verification', async () => {
    const { session, run } = setup()
    await session.getState().login({ login: UNVERIFIED_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    expect(await run.getState().start()).toBe('needs_verification')
    expect(run.getState().config).toBeNull()
    // the player can still play as guest without losing the session
    expect(run.getState().startGuest()).toBe('started')
    expect(run.getState().config?.mode).toBe('guest')
    expect(session.getState().status).toBe('authenticated')
  })

  it('finish with the network down keeps the result; retrySubmit sends it later', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const runId = run.getState().config!.runId
    const endRun = vi.spyOn(api, 'endRun').mockRejectedValueOnce(network())
    await run.getState().finish(result(runId))
    expect(run.getState().submitError).toMatch(/Impossibile contattare il server/)
    expect(run.getState().result?.kills).toBe(40)
    expect(run.getState().outcome).toBeNull()

    const setSave = vi.spyOn(session.getState(), 'setSave')
    await run.getState().retrySubmit()
    expect(endRun).toHaveBeenCalledTimes(2)
    expect(endRun.mock.calls[1][1]).not.toHaveProperty('runId')
    expect(run.getState().submitError).toBeNull()
    expect(run.getState().outcome?.eurodollarsAwarded).toBeGreaterThan(0)
    expect(setSave).toHaveBeenCalledWith(run.getState().outcome!.save)
  })

  it('a second onEnd for the same run is ignored', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const endRun = vi.spyOn(api, 'endRun')
    const r = result(run.getState().config!.runId)
    await Promise.all([run.getState().finish(r), run.getState().finish(r)])
    expect(endRun).toHaveBeenCalledTimes(1)
  })

  it('a checkpoint that fails never throws (network and 422)', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const checkpoint = vi
      .spyOn(api, 'checkpoint')
      .mockRejectedValueOnce(network())
      .mockRejectedValueOnce(new ApiError(422, null, null))
    const c = { elapsedSec: 60, kills: 10, level: 3, eurodollars: 5 }
    expect(() => run.getState().onCheckpoint(c)).not.toThrow()
    expect(() => run.getState().onCheckpoint(c)).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
    expect(checkpoint).toHaveBeenCalledTimes(2)
  })

  it('a rate-limited checkpoint (429) is ignored silently and the run goes on', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const config = run.getState().config
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const checkpoint = vi
      .spyOn(api, 'checkpoint')
      .mockRejectedValueOnce(problemError(429, 'Checkpoint troppo frequente', undefined, 5))
    const c = { elapsedSec: 0, kills: 10, level: 3, eurodollars: 5 }
    expect(() => run.getState().onCheckpoint(c)).not.toThrow()
    expect(checkpoint).toHaveBeenCalledTimes(1)
    await checkpoint.mock.results[0].value.catch(() => {})
    await new Promise((r) => setTimeout(r, 0))
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(run.getState()).toMatchObject({ config, result: null, outcome: null, submitError: null })

    // the next checkpoint is sent normally and the run still ends with its result
    run.getState().onCheckpoint(c)
    expect(checkpoint).toHaveBeenCalledTimes(2)
    await run.getState().finish(result(config!.runId))
    expect(run.getState().outcome).not.toBeNull()
  })

  it('guest checkpoints and results never call the API', async () => {
    const { api, session, run } = setup()
    session.getState().playAsGuest()
    const checkpoint = vi.spyOn(api, 'checkpoint')
    const endRun = vi.spyOn(api, 'endRun')
    run.getState().select('david')
    await run.getState().start()
    run.getState().onCheckpoint({ elapsedSec: 60, kills: 1, level: 1, eurodollars: 0 })
    await run.getState().finish(result(null))
    expect(checkpoint).not.toHaveBeenCalled()
    expect(endRun).not.toHaveBeenCalled()
    expect(run.getState().result).not.toBeNull()
    // guest discoveries live in memory for the Codex
    expect(run.getState().guestCodex).toEqual({ enemies: ['maelstrom'], weapons: ['pistol', 'shotgun'] })
  })

  it('session lost during the run: the result waits for a new login, then is sent', async () => {
    const { auth, api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const runId = run.getState().config!.runId
    auth.authLost() // refresh failed in the middle of the run
    expect(session.getState().status).toBe('guest')
    const endRun = vi.spyOn(api, 'endRun')
    await run.getState().finish(result(runId))
    expect(endRun).not.toHaveBeenCalled()
    expect(run.getState().needsLogin).toBe(true)
    expect(run.getState().result).not.toBeNull()

    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    await run.getState().retrySubmit()
    expect(endRun).toHaveBeenCalledTimes(1)
    expect(run.getState().needsLogin).toBe(false)
    expect(run.getState().outcome).not.toBeNull()
  })

  it('endRun 401 after the refresh failed asks to log in again and keeps the result', async () => {
    const { auth, api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    vi.spyOn(api, 'endRun').mockImplementationOnce(async () => {
      auth.authLost() // the HTTP layer could not refresh
      throw new ApiError(401, null, null)
    })
    await run.getState().finish(result(run.getState().config!.runId))
    expect(run.getState().needsLogin).toBe(true)
    expect(run.getState().result).not.toBeNull()
  })

  it('endRun 401 while still logged in is a plain failure (no login loop)', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    vi.spyOn(api, 'endRun').mockRejectedValueOnce(new ApiError(401, null, null))
    await run.getState().finish(result(run.getState().config!.runId))
    expect(session.getState().status).toBe('authenticated')
    expect(run.getState().needsLogin).toBe(false)
    expect(run.getState().submitError).toMatch(/Invio del risultato non riuscito/)
    expect(run.getState().canRetry).toBe(true)
  })

  it('endRun 409 twice (run closed on the server) is final after one automatic retry', async () => {
    const { api, session, run, sleep } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const endRun = vi
      .spyOn(api, 'endRun')
      .mockRejectedValueOnce(new ApiError(409, null, null))
      .mockRejectedValueOnce(new ApiError(409, null, null))
    await run.getState().finish(result(run.getState().config!.runId))
    expect(endRun).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(run.getState().submitError).toMatch(/Il server ha già chiuso questa run/)
    expect(run.getState().canRetry).toBe(false)
  })

  it('endRun 409 once (transient lock conflict) is retried after about 1 s and succeeds', async () => {
    const { api, session, run, sleep } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const endRun = vi.spyOn(api, 'endRun').mockRejectedValueOnce(problemError(409, 'Conflitto'))
    const setSave = vi.spyOn(session.getState(), 'setSave')
    await run.getState().finish(result(run.getState().config!.runId))
    expect(sleep).toHaveBeenCalledWith(1000)
    expect(endRun).toHaveBeenCalledTimes(2)
    expect(run.getState().submitError).toBeNull()
    expect(run.getState().outcome).not.toBeNull()
    expect(setSave).toHaveBeenCalledTimes(1)
  })

  it('a lost end response: retrySubmit gets the stored outcome (200 replay) and shows it', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    const realEnd = api.endRun.bind(api)
    // the server ends the run, but the response never reaches the client
    const endRun = vi.spyOn(api, 'endRun').mockImplementationOnce(async (id, body) => {
      await realEnd(id, body)
      throw network()
    })
    await run.getState().finish(result(run.getState().config!.runId))
    expect(run.getState().outcome).toBeNull()
    expect(run.getState().canRetry).toBe(true)

    const setSave = vi.spyOn(session.getState(), 'setSave')
    await run.getState().retrySubmit()
    expect(endRun).toHaveBeenCalledTimes(2)
    expect(run.getState().submitError).toBeNull()
    expect(run.getState().outcome?.eurodollarsAwarded).toBeGreaterThan(0)
    expect(setSave).toHaveBeenCalledTimes(1)
    expect(setSave).toHaveBeenCalledWith(run.getState().outcome!.save)
  })
  it('guest seed stays within the contract range (0..2147483646)', async () => {
    const { session, run } = setup()
    session.getState().playAsGuest()
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as unknown as Uint32Array).fill(0xffffffff)
      return array
    })
    run.getState().select('david')
    await run.getState().start()
    expect(run.getState().config!.seed).toBeLessThanOrEqual(2147483646)
  })
  it('refuses a new run while an online result is unsent and retryable (it would be abandoned)', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    vi.spyOn(api, 'endRun').mockRejectedValueOnce(network())
    await run.getState().finish(result(run.getState().config!.runId))
    expect(hasUnsentResult(run.getState())).toBe(true)
    const startRun = vi.spyOn(api, 'startRun')
    expect(await run.getState().start()).toBe('unsent_result')
    expect(run.getState().startGuest()).toBe('unsent_result')
    expect(startRun).not.toHaveBeenCalled()
    expect(run.getState().result?.kills).toBe(40)
    // once sent, a new run can start
    await run.getState().retrySubmit()
    expect(hasUnsentResult(run.getState())).toBe(false)
    expect(await run.getState().start()).toBe('started')
  })

  it('keeps the previous result until the new run config arrives, and on failure', async () => {
    const { api, session, run } = setup()
    await session.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    run.getState().select('david')
    await run.getState().start()
    await run.getState().finish(result(run.getState().config!.runId))
    expect(run.getState().outcome).not.toBeNull()
    vi.spyOn(api, 'startRun').mockRejectedValueOnce(network())
    const pending = run.getState().start()
    expect(run.getState().result).not.toBeNull()
    expect(await pending).toBe('error')
    expect(run.getState().result).not.toBeNull()
    expect(run.getState().startError).toMatch(/Impossibile contattare il server/)
    expect(await run.getState().start()).toBe('started')
    expect(run.getState().result).toBeNull()
    expect(run.getState().startError).toBeNull()
  })
})
