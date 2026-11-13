import { create } from 'zustand'
import type { AuthResponse, LoginRequest, SaveDto, UserDto } from '@shared/api-contract'
import type { Locale } from '@shared/types'
import { api as defaultApi, authBridge as defaultAuth, type ApiClient, type AuthBridge } from '../../api'
import { isApiError } from '../../api/errors'

export type SessionStatus = 'unknown' | 'guest' | 'authenticated'

export interface SessionState {
  status: SessionStatus
  user: UserDto | null
  /** Mirror of the in-memory token (never persisted). */
  accessToken: string | null
  save: SaveDto | null
  /** True after the API lost the session (refresh failed): the UI sends the user to /login. */
  sessionExpired: boolean
  /** Bootstrap could not reach /auth/refresh (network, 429, 5xx): status stays 'unknown', retry or play as guest. */
  bootstrapFailed: boolean
  bootstrap(): Promise<void>
  login(r: LoginRequest): Promise<void>
  logout(): Promise<void>
  setSave(s: SaveDto): void
  setUser(u: UserDto): void
  playAsGuest(): void
  reloadSave(): Promise<void>
  /**
   * Saves a language chosen on this device on the account (emails), when authenticated.
   * Best effort: never throws. Login and bootstrap never change the device language.
   */
  updateLocale(locale: Locale): Promise<void>
  clearExpired(): void
}

const signedOut = { status: 'guest' as const, user: null, accessToken: null, save: null, bootstrapFailed: false }

export function createSessionStore(deps: { api: ApiClient; auth: AuthBridge }) {
  const { api, auth } = deps

  /** The session exists once we hold a token; the save loads after and may fail (save null, reloadSave). */
  async function authenticate(res: AuthResponse) {
    auth.setToken(res.accessToken)
    store.setState({
      status: 'authenticated',
      user: res.user,
      accessToken: res.accessToken,
      save: null,
      sessionExpired: false,
      bootstrapFailed: false,
    })
    try {
      const save = await api.getSave()
      if (store.getState().accessToken === res.accessToken) store.setState({ save })
    } catch {
      // the screens that need the save call reloadSave()
    }
  }

  // account locale sync (PUT /me/locale): latest device choice not yet sent, and the running loop
  let wantedLocale: Locale | null = null
  let localeSync: Promise<void> | null = null

  async function syncLocale() {
    while (wantedLocale !== null) {
      const target = wantedLocale
      wantedLocale = null
      const { status, user } = store.getState()
      if (status !== 'authenticated' || !user) return
      if (user.locale === target) continue
      try {
        await api.updateLocale({ locale: target })
        const current = store.getState().user
        if (current?.id === user.id) store.setState({ user: { ...current, locale: target } })
      } catch {
        // best effort: the device keeps the new language; the account is updated at the next change
      }
    }
  }

  const store = create<SessionState>()((set, get) => ({
    status: 'unknown',
    user: null,
    accessToken: null,
    save: null,
    sessionExpired: false,
    bootstrapFailed: false,

    async bootstrap() {
      set({ bootstrapFailed: false })
      let res: AuthResponse
      try {
        res = await api.refresh()
      } catch (error) {
        if (isApiError(error, 401) || isApiError(error, 403)) {
          // no valid refresh cookie: play as guest
          auth.setToken(null)
          set({ ...signedOut })
        } else {
          // network down, 429, 5xx: the cookie may still be valid, do not log out silently
          set({ bootstrapFailed: true })
        }
        return
      }
      await authenticate(res)
    },

    async login(r) {
      await authenticate(await api.login(r))
    },

    async logout() {
      try {
        await api.logout()
      } catch {
        // the local session ends anyway; the cookie expires on its own
      } finally {
        auth.setToken(null)
        set({ ...signedOut })
      }
    },

    setSave: (save) => set({ save }),
    setUser: (user) => set({ user }),

    playAsGuest() {
      auth.setToken(null)
      set({ ...signedOut })
    },

    async reloadSave() {
      if (get().status !== 'authenticated') return
      const save = await api.getSave()
      set({ save })
    },

    updateLocale(locale) {
      if (get().status !== 'authenticated') return Promise.resolve()
      // one request at a time; whatever the device chose last is sent when the current one ends
      wantedLocale = locale
      localeSync ??= syncLocale().finally(() => {
        localeSync = null
      })
      return localeSync
    },

    clearExpired: () => set({ sessionExpired: false }),
  }))

  auth.onTokenChange((token) => {
    if (store.getState().accessToken !== token) store.setState({ accessToken: token })
  })
  auth.onAuthLost(() => {
    if (store.getState().status === 'authenticated') store.setState({ ...signedOut, sessionExpired: true })
  })

  return store
}

export const useSession = createSessionStore({ api: defaultApi, auth: defaultAuth })
