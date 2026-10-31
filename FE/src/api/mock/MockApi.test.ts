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
})
