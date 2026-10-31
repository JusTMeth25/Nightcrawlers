import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/ApiClient'
import { createAuthBridge } from '../../api/auth'
import { ApiError } from '../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD, MockApi } from '../../api/mock/MockApi'
import { createSessionStore } from './session'

function setup(overrides: Partial<ApiClient> = {}) {
  const auth = createAuthBridge()
  const mock = new MockApi({ auth, latencyMs: 0 })
  const api = Object.assign(mock, overrides) as ApiClient
  const store = createSessionStore({ api, auth })
  return { auth, api, mock, store }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('session store', () => {
  it('starts unknown', () => {
    const { store } = setup()
    expect(store.getState().status).toBe('unknown')
  })

  it('bootstrap with a valid refresh cookie restores the authenticated session with the save', async () => {
    const { store, mock, auth } = setup()
    await mock.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD }) // sets the mock refresh cookie
    await store.getState().bootstrap()
    const s = store.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user?.username).toBe('demo')
    expect(s.save).not.toBeNull()
    expect(s.accessToken).toBeTruthy()
    expect(auth.getToken()).toBe(s.accessToken)
  })

  it('bootstrap with refresh 401 becomes guest', async () => {
    const { store } = setup({ refresh: () => Promise.reject(new ApiError(401, null, null)) })
    await store.getState().bootstrap()
    expect(store.getState().status).toBe('guest')
    expect(store.getState().user).toBeNull()
  })

  it('bootstrap with the network down becomes guest', async () => {
    const { store } = setup({ refresh: () => Promise.reject(new ApiError(0, null, null)) })
    await store.getState().bootstrap()
    expect(store.getState().status).toBe('guest')
  })

  it('login authenticates and loads the save; logout returns to guest with no token', async () => {
    const { store, auth } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    expect(store.getState().status).toBe('authenticated')
    expect(store.getState().save?.unlockedCharacters).toContain('david')
    await store.getState().logout()
    const s = store.getState()
    expect(s.status).toBe('guest')
    expect(s.accessToken).toBeNull()
    expect(s.user).toBeNull()
    expect(s.save).toBeNull()
    expect(auth.getToken()).toBeNull()
  })

  it('logout ends the local session even when the server call fails', async () => {
    const failing = vi.fn(() => Promise.reject(new ApiError(0, null, null)))
    const { store: s2 } = setup({ logout: failing })
    await s2.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    await s2.getState().logout()
    expect(failing).toHaveBeenCalled()
    expect(s2.getState().status).toBe('guest')
  })

  it('never writes the access token to web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { store } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    await store.getState().bootstrap()
    const token = store.getState().accessToken
    expect(token).toBeTruthy()
    for (const [, value] of setItem.mock.calls) expect(String(value)).not.toContain(token as string)
    expect(JSON.stringify({ ...localStorage })).not.toContain(token as string)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(token as string)
  })

  it('goes back to guest and flags the expiry when the API reports the auth as lost', async () => {
    const { store, auth } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    auth.authLost()
    expect(store.getState().status).toBe('guest')
    expect(store.getState().accessToken).toBeNull()
    expect(store.getState().sessionExpired).toBe(true)
  })

  it('tracks a token refreshed by the HTTP layer', async () => {
    const { store, auth } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    auth.setToken('rotated')
    expect(store.getState().accessToken).toBe('rotated')
  })

  it('playAsGuest and setSave', async () => {
    const { store } = setup()
    store.getState().playAsGuest()
    expect(store.getState().status).toBe('guest')
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    const save = { ...store.getState().save!, eurodollars: 7 }
    store.getState().setSave(save)
    expect(store.getState().save?.eurodollars).toBe(7)
    await store.getState().reloadSave()
    expect(store.getState().save?.eurodollars).not.toBe(7)
  })
})
