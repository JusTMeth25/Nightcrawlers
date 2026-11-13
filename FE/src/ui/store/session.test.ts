import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../../api/ApiClient'
import { createAuthBridge } from '../../api/auth'
import { ApiError } from '../../api/errors'
import { DEMO_LOGIN, DEMO_PASSWORD, MockApi } from '../../api/mock/MockApi'
import { getLocale, setLocale } from '../i18n/locale'
import { createSessionStore } from './session'

function setup(overrides: Partial<ApiClient> = {}) {
  const auth = createAuthBridge()
  const mock = new MockApi({ auth, latencyMs: 0 })
  const api = Object.assign(mock, overrides) as ApiClient
  const store = createSessionStore({ api, auth })
  return { auth, api, mock, store }
}

afterEach(() => {
  setLocale('it')
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

  it('bootstrap with refresh 403 becomes guest', async () => {
    const { store } = setup({ refresh: () => Promise.reject(new ApiError(403, null, null)) })
    await store.getState().bootstrap()
    expect(store.getState().status).toBe('guest')
    expect(store.getState().bootstrapFailed).toBe(false)
  })

  it.each([0, 429, 503])('bootstrap with refresh %i keeps the status unknown with a retryable error', async (status) => {
    const { store, mock } = setup()
    await mock.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD }) // valid cookie on the "server"
    const realRefresh = mock.refresh.bind(mock)
    mock.refresh = () => Promise.reject(new ApiError(status, null, null))
    await store.getState().bootstrap()
    expect(store.getState().status).toBe('unknown')
    expect(store.getState().bootstrapFailed).toBe(true)
    mock.refresh = realRefresh
    await store.getState().bootstrap()
    expect(store.getState().status).toBe('authenticated')
    expect(store.getState().bootstrapFailed).toBe(false)
  })

  it('bootstrap stays authenticated with save null when getSave fails after a good refresh', async () => {
    const { store, mock } = setup()
    await mock.login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    mock.getSave = () => Promise.reject(new ApiError(503, null, null))
    await store.getState().bootstrap()
    const s = store.getState()
    expect(s.status).toBe('authenticated')
    expect(s.user?.username).toBe('demo')
    expect(s.save).toBeNull()
    expect(s.accessToken).toBeTruthy()
  })

  it('login stays authenticated with save null when getSave fails, and reloadSave recovers it', async () => {
    const { store, mock, auth } = setup()
    const realGetSave = mock.getSave.bind(mock)
    mock.getSave = () => Promise.reject(new ApiError(0, null, null))
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    const s = store.getState()
    expect(s.status).toBe('authenticated')
    expect(s.save).toBeNull()
    expect(s.accessToken).toBe(auth.getToken())
    mock.getSave = realGetSave
    await store.getState().reloadSave()
    expect(store.getState().save).not.toBeNull()
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

describe('session locale', () => {
  // review focus 2: a second device with an English browser must not switch to the account's Italian
  it('login and bootstrap keep the device locale and never update the account locale', async () => {
    const { store, mock } = setup()
    const update = vi.spyOn(mock, 'updateLocale')
    setLocale('en')
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    expect(store.getState().user?.locale).toBe('it')
    expect(getLocale()).toBe('en')
    await store.getState().bootstrap()
    expect(getLocale()).toBe('en')
    expect(update).not.toHaveBeenCalled()
  })

  it('updateLocale saves the choice on the account once when authenticated', async () => {
    const { store, mock } = setup()
    const update = vi.spyOn(mock, 'updateLocale')
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    await store.getState().updateLocale('es')
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ locale: 'es' })
    expect(store.getState().user?.locale).toBe('es')
  })

  it('updateLocale does nothing for a guest and never throws', async () => {
    const { store, mock } = setup()
    const update = vi.spyOn(mock, 'updateLocale')
    store.getState().playAsGuest()
    await store.getState().updateLocale('en')
    expect(update).not.toHaveBeenCalled()

    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    update.mockRejectedValueOnce(new ApiError(0, null, null))
    await expect(store.getState().updateLocale('en')).resolves.toBeUndefined()
    expect(store.getState().status).toBe('authenticated')
  })

  // a fake server whose PUT /me/locale answers only when the test resolves it
  function slowServer(store: ReturnType<typeof setup>['store'], mock: MockApi) {
    let server: string = 'it'
    let inFlight = 0
    let maxInFlight = 0
    const pending: (() => void)[] = []
    const sent: string[] = []
    vi.spyOn(mock, 'updateLocale').mockImplementation(async ({ locale }) => {
      sent.push(locale)
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise<void>((resolve) => pending.push(resolve))
      server = locale
      inFlight--
    })
    const flush = async () => {
      while (pending.length > 0) {
        // answer the most recent request first (worst case for ordering)
        pending.pop()!()
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    return { sent, flush, server: () => server, maxInFlight: () => maxInFlight, store }
  }

  it('rapid it -> en -> it ends with the account in Italian', async () => {
    const { store, mock } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    const s = slowServer(store, mock)
    const a = store.getState().updateLocale('en')
    const b = store.getState().updateLocale('it')
    await s.flush()
    await Promise.all([a, b])
    expect(s.server()).toBe('it')
    expect(store.getState().user?.locale).toBe('it')
  })

  it('it -> en -> es with answers out of order ends with the account in Spanish', async () => {
    const { store, mock } = setup()
    await store.getState().login({ login: DEMO_LOGIN, password: DEMO_PASSWORD })
    const s = slowServer(store, mock)
    const a = store.getState().updateLocale('en')
    const b = store.getState().updateLocale('es')
    await s.flush()
    await Promise.all([a, b])
    expect(s.server()).toBe('es')
    expect(s.sent.at(-1)).toBe('es')
    expect(s.maxInFlight()).toBe(1)
    expect(store.getState().user?.locale).toBe('es')
  })
})

