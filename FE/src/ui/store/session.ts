import { create } from 'zustand'
import type { LoginRequest, SaveDto, UserDto } from '@shared/api-contract'
import { api as defaultApi, authBridge as defaultAuth, type ApiClient, type AuthBridge } from '../../api'

export type SessionStatus = 'unknown' | 'guest' | 'authenticated'

export interface SessionState {
  status: SessionStatus
  user: UserDto | null
  /** Mirror of the in-memory token (never persisted). */
  accessToken: string | null
  save: SaveDto | null
  /** True after the API lost the session (refresh failed): the UI sends the user to /login. */
  sessionExpired: boolean
  bootstrap(): Promise<void>
  login(r: LoginRequest): Promise<void>
  logout(): Promise<void>
  setSave(s: SaveDto): void
  setUser(u: UserDto): void
  playAsGuest(): void
  reloadSave(): Promise<void>
  clearExpired(): void
}

const signedOut = { status: 'guest' as const, user: null, accessToken: null, save: null }

export function createSessionStore(deps: { api: ApiClient; auth: AuthBridge }) {
  const { api, auth } = deps

  const store = create<SessionState>()((set, get) => ({
    status: 'unknown',
    user: null,
    accessToken: null,
    save: null,
    sessionExpired: false,

    async bootstrap() {
      try {
        const res = await api.refresh()
        auth.setToken(res.accessToken)
        const save = await api.getSave()
        set({ status: 'authenticated', user: res.user, accessToken: res.accessToken, save, sessionExpired: false })
      } catch {
        // 401/403 (no cookie), network down, or anything else: play as guest
        auth.setToken(null)
        set({ ...signedOut })
      }
    },

    async login(r) {
      const res = await api.login(r)
      auth.setToken(res.accessToken)
      const save = await api.getSave()
      set({ status: 'authenticated', user: res.user, accessToken: res.accessToken, save, sessionExpired: false })
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
