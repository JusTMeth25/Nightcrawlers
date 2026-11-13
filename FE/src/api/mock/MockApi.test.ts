import { describe, expect, it } from 'vitest'
import { createAuthBridge } from '../auth'
import { ApiError } from '../errors'
import { DEMO_LOGIN, DEMO_PASSWORD, MockApi, UNVERIFIED_LOGIN } from './MockApi'

function setup() {
  const auth = createAuthBridge()
  const api = new MockApi({ auth, latencyMs: 0 })
  return { auth, api }
}

describe('MockApi', () => {
  it('logs the demo user in and serves the save', async () => {
    const { api, auth } = setup()
    const res = await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    expect(res.user.username).toBe('demo')
    expect(res.user.emailVerified).toBe(true)
    auth.setToken(res.accessToken)
    const save = await api.getSave()
    expect(save.unlockedCharacters).toEqual(expect.arrayContaining(['david', 'lucy', 'rebecca']))
  })

  it('rejects wrong credentials with 401', async () => {
    const { api } = setup()
    await expect(api.login({ login: DEMO_LOGIN, password: 'wrong-password-000' })).rejects.toMatchObject({ status: 401 })
  })

  it('rejects bearer calls without a valid token with 401', async () => {
    const { api } = setup()
    await expect(api.getSave()).rejects.toMatchObject({ status: 401 })
  })

  it('answers 409 when buying a Ripperdoc rank without enough eurodollars', async () => {
    const auth = createAuthBridge()
    const api = new MockApi({ auth, latencyMs: 0, demoEurodollars: 0 })
    const res = await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    auth.setToken(res.accessToken)
    const error = await api.buyRipperdoc('max_hp').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).problem?.title).toBeTruthy()
  })

  it('sells a Ripperdoc rank and returns the updated save', async () => {
    const { api, auth } = setup()
    const res = await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    auth.setToken(res.accessToken)
    const before = await api.getSave()
    const after = await api.buyRipperdoc('armor')
    expect(after.ripperdoc.armor).toBe((before.ripperdoc.armor ?? 0) + 1)
    expect(after.eurodollars).toBeLessThan(before.eurodollars)
  })

  it('answers 403 to startRun and buyRipperdoc for an unverified user', async () => {
    const { api, auth } = setup()
    const res = await api.login({ login: UNVERIFIED_LOGIN, password: DEMO_PASSWORD })
    auth.setToken(res.accessToken)
    await expect(api.startRun({ characterId: 'david' })).rejects.toMatchObject({ status: 403 })
    await expect(api.buyRipperdoc('armor')).rejects.toMatchObject({ status: 403 })
  })

  it('answers 409 with a username error for a taken username, 202 for a taken email', async () => {
    const { api } = setup()
    await expect(
      api.register({ username: 'demo', email: 'new@example.com', password: 'a-long-password-1' }),
    ).rejects.toMatchObject({ status: 409, problem: { errors: { username: expect.any(String) } } })
    await expect(
      api.register({ username: 'newbie', email: 'demo@nightcrawlers.test', password: 'a-long-password-1' }),
    ).resolves.toEqual({ message: expect.any(String) })
  })

  it('restores the session with refresh after login and loses it after logout', async () => {
    const { api } = setup()
    await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    await expect(api.refresh()).resolves.toMatchObject({ user: { username: 'demo' } })
    await api.logout()
    await expect(api.refresh()).rejects.toMatchObject({ status: 401 })
  })

  it('answers 403 when deleting the account with a wrong password', async () => {
    const { api, auth } = setup()
    const res = await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    auth.setToken(res.accessToken)
    await expect(api.deleteAccount({ password: 'nope-nope-nope' })).rejects.toMatchObject({ status: 403 })
  })
  it('ending a run twice replays the stored outcome; an abandoned run answers 409', async () => {
    const { api, auth } = setup()
    auth.setToken((await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })).accessToken)
    const body = {
      characterId: 'david' as const,
      durationSec: 120,
      kills: 30,
      killsByEnemy: { maelstrom: 30 },
      level: 5,
      eurodollarsCollected: 0,
      weaponsSeen: [],
      enemiesSeen: [],
    }
    const { runId } = await api.startRun({ characterId: 'david' })
    const first = await api.endRun(runId, body)
    const replay = await api.endRun(runId, body)
    expect(replay).toEqual(first)

    const abandoned = await api.startRun({ characterId: 'david' })
    await api.startRun({ characterId: 'david' })
    await expect(api.endRun(abandoned.runId, body)).rejects.toMatchObject({ status: 409 })
  })

  it('ending a flagged run answers 200 with flagged: true and no reward', async () => {
    const { api, auth } = setup()
    auth.setToken((await api.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })).accessToken)
    const { runId } = await api.startRun({ characterId: 'david' })
    await expect(api.checkpoint(runId, { elapsedSec: 9999, kills: 0, level: 1, eurodollars: 0 })).rejects.toMatchObject({
      status: 422,
    })
    const res = await api.endRun(runId, {
      characterId: 'david',
      durationSec: 9999,
      kills: 0,
      killsByEnemy: {},
      level: 1,
      eurodollarsCollected: 0,
      weaponsSeen: [],
      enemiesSeen: [],
    })
    expect(res).toMatchObject({ flagged: true, eurodollarsAwarded: 0, newUnlocks: [] })
  })

  it('stores the registration locale (Italian when omitted) and updates it with PUT /me/locale', async () => {
    const { api, auth } = setup()
    await api.register({ username: 'neo_es', email: 'es@x.test', password: 'una-password-lunga', locale: 'es' })
    await api.register({ username: 'neo_it', email: 'it@x.test', password: 'una-password-lunga' })
    const es = await api.login({ login: 'neo_es', password: 'una-password-lunga' })
    expect(es.user.locale).toBe('es')
    const it_ = await api.login({ login: 'neo_it', password: 'una-password-lunga' })
    expect(it_.user.locale).toBe('it')
    auth.setToken(it_.accessToken)
    await api.updateLocale({ locale: 'en' })
    expect((await api.me()).locale).toBe('en')
    await expect(api.updateLocale({ locale: 'fr' as never })).rejects.toMatchObject({ status: 400 })
    auth.setToken(null)
    await expect(api.updateLocale({ locale: 'en' })).rejects.toMatchObject({ status: 401 })
  })
})
