// In-memory holder of the access token, shared by the HTTP layer and the session store.
// The token is never written to localStorage/sessionStorage: a page reload drops it and
// the session is restored through the HttpOnly refresh cookie (POST /auth/refresh).

export interface AuthBridge {
  getToken(): string | null
  setToken(token: string | null): void
  onTokenChange(fn: (token: string | null) => void): () => void
  /** The refresh failed while a request needed auth: the session is over. */
  authLost(): void
  onAuthLost(fn: () => void): () => void
}

export function createAuthBridge(): AuthBridge {
  let token: string | null = null
  const tokenListeners = new Set<(token: string | null) => void>()
  const lostListeners = new Set<() => void>()

  const setToken = (next: string | null) => {
    if (next === token) return
    token = next
    for (const fn of [...tokenListeners]) fn(next)
  }

  return {
    getToken: () => token,
    setToken,
    onTokenChange(fn) {
      tokenListeners.add(fn)
      return () => tokenListeners.delete(fn)
    },
    authLost() {
      setToken(null)
      for (const fn of [...lostListeners]) fn()
    },
    onAuthLost(fn) {
      lostListeners.add(fn)
      return () => lostListeners.delete(fn)
    },
  }
}
