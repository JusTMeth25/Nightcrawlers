import { randomBytes } from 'node:crypto'

export interface TestUser {
  username: string
  email: string
  password: string
}

/** A fresh user per test: usernames are 3–20 chars of [A-Za-z0-9_], passwords 12+ chars without the username. */
export function newUser(prefix = 'e2e'): TestUser {
  const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString('hex')}`
  const username = `${prefix}_${suffix}`.slice(0, 20)
  return {
    username,
    email: `${username.toLowerCase()}@example.test`,
    password: `Neon-${randomBytes(9).toString('base64url')}-Night!`,
  }
}
