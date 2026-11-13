// In-memory fake of the backend for development (VITE_API_MOCK=true) and tests.
// It follows the status codes of docs/api/openapi.yaml. State is lost on reload.
import type {
  AuthResponse,
  BestRunDto,
  CheckpointRequest,
  DeleteAccountRequest,
  EndRunRequest,
  EndRunResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SaveDto,
  StartRunRequest,
  StartRunResponse,
  UpdateLocaleRequest,
  UserDto,
  VerifyEmailRequest,
} from '@shared/api-contract'
import {
  STARTER_CHARACTERS,
  SUPPORTED_LOCALES,
  type CharacterId,
  type Locale,
  type RipperdocUpgradeId,
  type UnlockRule,
} from '@shared/types'
import { balance, getRipperdoc, ripperdocCost, unlocks } from '@data'
import type { ApiClient } from '../ApiClient'
import type { AuthBridge } from '../auth'
import { problemError } from '../errors'

export const DEMO_LOGIN = 'demo'
export const UNVERIFIED_LOGIN = 'rookie'
export const DEMO_PASSWORD = 'demo-password-123'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const COMMON_PASSWORDS = new Set(['password1234', '123456789012', 'qwertyuiopas', 'nightcrawlers'])
const ACCEPTED: MessageResponse = { message: 'Se i dati sono corretti riceverai una email.' }

interface MockUser {
  user: UserDto
  password: string
  save: SaveDto
  runs: BestRunDto[]
}
interface MockRun {
  userId: string
  characterId: CharacterId
  startedAt: number
  ended: boolean
  /** true when a checkpoint flagged the run */
  flagged?: boolean
  /** stored outcome of an ended run, replayed when the client ends it again */
  outcome?: EndRunResponse
}

function emptySave(): SaveDto {
  return {
    eurodollars: 0,
    totalEurodollarsEarned: 0,
    totalKills: 0,
    bestTimeSec: 0,
    unlockedCharacters: [...STARTER_CHARACTERS],
    ripperdoc: {},
    killStats: {},
    characterStats: {},
    codex: { enemies: [], weapons: [] },
  }
}

function demoSave(eurodollars: number): SaveDto {
  return {
    eurodollars,
    totalEurodollarsEarned: 3200,
    totalKills: 2140,
    bestTimeSec: 950,
    unlockedCharacters: [...STARTER_CHARACTERS, 'maine'],
    ripperdoc: { max_hp: 1, might: 2 },
    killStats: { maelstrom: 2000, arasaka: 128, maxtac: 12 },
    characterStats: { david: { bestTimeSec: 950, runs: 7 }, lucy: { bestTimeSec: 920, runs: 3 }, rebecca: { bestTimeSec: 400, runs: 2 } },
    codex: { enemies: ['maelstrom', 'arasaka', 'maxtac'], weapons: ['pistol', 'shotgun', 'monowire'] },
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function ruleMet(rule: UnlockRule, save: SaveDto): boolean {
  switch (rule.type) {
    case 'survive':
      return save.bestTimeSec >= rule.seconds
    case 'kills':
      return (save.killStats[rule.enemyId] ?? 0) >= rule.count
    case 'eurodollars_total':
      return save.totalEurodollarsEarned >= rule.amount
    case 'survive_with':
      return (save.characterStats[rule.characterId]?.bestTimeSec ?? 0) >= rule.seconds
    case 'distinct_characters':
      return Object.values(save.characterStats).filter((s) => s && s.bestTimeSec >= rule.seconds).length >= rule.count
  }
}

export interface MockApiOptions {
  auth: AuthBridge
  /** Simulated network latency (default 150 ms). */
  latencyMs?: number
  /** Starting eurodollars of the demo user (default 2500). */
  demoEurodollars?: number
  log?: (message: string) => void
}

export class MockApi implements ApiClient {
  private readonly auth: AuthBridge
  private readonly latencyMs: number
  private readonly log: (message: string) => void
  private readonly users = new Map<string, MockUser>()
  private readonly accessTokens = new Map<string, string>()
  private readonly emailTokens = new Map<string, { userId: string; purpose: 'verify' | 'reset' }>()
  private readonly runs = new Map<string, MockRun>()
  /** user id behind the simulated HttpOnly refresh cookie */
  private cookieUserId: string | null = null

  constructor(options: MockApiOptions) {
    this.auth = options.auth
    this.latencyMs = options.latencyMs ?? 150
    this.log = options.log ?? ((message) => console.info(`[MockApi] ${message}`))
    this.addUser(DEMO_LOGIN, 'demo@nightcrawlers.test', DEMO_PASSWORD, true, demoSave(options.demoEurodollars ?? 2500))
    this.addUser(UNVERIFIED_LOGIN, 'rookie@nightcrawlers.test', DEMO_PASSWORD, false, emptySave())
  }

  private addUser(username: string, email: string, password: string, verified: boolean, save: SaveDto, locale: Locale = 'it') {
    const user: UserDto = {
      id: crypto.randomUUID(),
      username,
      email,
      emailVerified: verified,
      createdAt: new Date().toISOString(),
      locale,
    }
    const entry: MockUser = { user, password, save, runs: [] }
    this.users.set(user.id, entry)
    return entry
  }

  private async delay() {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    else await Promise.resolve()
  }

  private findBy(pred: (u: UserDto) => boolean) {
    for (const entry of this.users.values()) if (pred(entry.user)) return entry
    return null
  }

  private current(): MockUser {
    const token = this.auth.getToken()
    const userId = token ? this.accessTokens.get(token) : undefined
    const entry = userId ? this.users.get(userId) : undefined
    if (!entry) {
      // a real client would refresh here; the mock only has the bridge to signal it
      throw problemError(401, 'Sessione non valida')
    }
    return entry
  }

  private requireVerified(entry: MockUser) {
    if (!entry.user.emailVerified) throw problemError(403, 'Email non verificata')
  }

  private issue(entry: MockUser): AuthResponse {
    const accessToken = `mock.${randomToken()}`
    this.accessTokens.set(accessToken, entry.user.id)
    this.cookieUserId = entry.user.id
    this.auth.setToken(accessToken)
    return { accessToken, expiresInSec: 900, user: { ...entry.user } }
  }

  private passwordError(password: string, username: string): string | null {
    if (password.length < 12 || password.length > 128) return 'La password deve avere tra 12 e 128 caratteri'
    if (username && password.toLowerCase().includes(username.toLowerCase())) return 'La password non può contenere lo username'
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Password troppo comune'
    return null
  }

  private mailLink(userId: string, purpose: 'verify' | 'reset') {
    const token = randomToken()
    this.emailTokens.set(token, { userId, purpose })
    this.log(`${purpose === 'verify' ? 'verify link' : 'reset link'}: /${purpose === 'verify' ? 'verify-email' : 'reset-password'}?token=${token}`)
    return token
  }

  /** Last emailed token, for tests and manual checks. */
  lastEmailToken(purpose: 'verify' | 'reset'): string | null {
    let last: string | null = null
    for (const [token, t] of this.emailTokens) if (t.purpose === purpose) last = token
    return last
  }

  async register(r: RegisterRequest): Promise<MessageResponse> {
    await this.delay()
    const errors: Record<string, string> = {}
    if (!USERNAME_RE.test(r.username)) errors.username = 'Username non valido'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) errors.email = 'Email non valida'
    const pwd = this.passwordError(r.password, r.username)
    if (pwd) errors.password = pwd
    if (Object.keys(errors).length > 0) throw problemError(400, 'Dati non validi', errors)
    if (this.findBy((u) => u.username.toLowerCase() === r.username.toLowerCase())) {
      throw problemError(409, 'Username già in uso', { username: 'Username già in uso' })
    }
    const email = r.email.toLowerCase()
    if (this.findBy((u) => u.email === email)) {
      this.log(`informative email sent to ${email} (already registered)`)
      return ACCEPTED
    }
    // the real server falls back to Accept-Language, then Italian; the mock only to Italian
    const locale = r.locale && SUPPORTED_LOCALES.includes(r.locale) ? r.locale : 'it'
    const entry = this.addUser(r.username, email, r.password, false, emptySave(), locale)
    this.mailLink(entry.user.id, 'verify')
    return ACCEPTED
  }

  async verifyEmail(r: VerifyEmailRequest): Promise<void> {
    await this.delay()
    const t = this.emailTokens.get(r.token)
    if (!t || t.purpose !== 'verify') throw problemError(400, 'Token non valido o scaduto')
    this.emailTokens.delete(r.token)
    const entry = this.users.get(t.userId)
    if (entry) entry.user.emailVerified = true
  }

  async resendVerification(): Promise<void> {
    await this.delay()
    const entry = this.current()
    if (!entry.user.emailVerified) this.mailLink(entry.user.id, 'verify')
  }

  async login(r: LoginRequest): Promise<AuthResponse> {
    await this.delay()
    const login = r.login.toLowerCase()
    const entry = this.findBy((u) => u.username.toLowerCase() === login || u.email === login)
    if (!entry || entry.password !== r.password) throw problemError(401, 'Credenziali non valide')
    return this.issue(entry)
  }

  async refresh(): Promise<AuthResponse> {
    await this.delay()
    const entry = this.cookieUserId ? this.users.get(this.cookieUserId) : undefined
    if (!entry) throw problemError(401, 'Sessione scaduta')
    return this.issue(entry)
  }

  async logout(): Promise<void> {
    await this.delay()
    const token = this.auth.getToken()
    if (token) this.accessTokens.delete(token)
    this.cookieUserId = null
    this.auth.setToken(null)
  }

  async logoutAll(): Promise<void> {
    await this.delay()
    const entry = this.current()
    for (const [token, userId] of this.accessTokens) if (userId === entry.user.id) this.accessTokens.delete(token)
    this.cookieUserId = null
    this.auth.setToken(null)
  }

  async forgotPassword(r: ForgotPasswordRequest): Promise<MessageResponse> {
    await this.delay()
    const entry = this.findBy((u) => u.email === r.email.toLowerCase())
    if (entry) this.mailLink(entry.user.id, 'reset')
    return ACCEPTED
  }

  async resetPassword(r: ResetPasswordRequest): Promise<void> {
    await this.delay()
    const t = this.emailTokens.get(r.token)
    const entry = t?.purpose === 'reset' ? this.users.get(t.userId) : undefined
    if (!entry) throw problemError(400, 'Token non valido o scaduto')
    const pwd = this.passwordError(r.newPassword, entry.user.username)
    if (pwd) throw problemError(400, 'Dati non validi', { newPassword: pwd })
    this.emailTokens.delete(r.token)
    entry.password = r.newPassword
    for (const [token, userId] of this.accessTokens) if (userId === entry.user.id) this.accessTokens.delete(token)
    if (this.cookieUserId === entry.user.id) this.cookieUserId = null
  }

  async me(): Promise<UserDto> {
    await this.delay()
    return { ...this.current().user }
  }

  async updateLocale(r: UpdateLocaleRequest): Promise<void> {
    await this.delay()
    const entry = this.current()
    if (!SUPPORTED_LOCALES.includes(r.locale)) throw problemError(400, 'Lingua non supportata', { locale: 'Lingua non supportata' })
    entry.user.locale = r.locale
  }

  async exportData(): Promise<Blob> {
    await this.delay()
    const entry = this.current()
    const data = { user: entry.user, save: entry.save, runs: entry.runs }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }

  async deleteAccount(r: DeleteAccountRequest): Promise<void> {
    await this.delay()
    const entry = this.current()
    if (entry.password !== r.password) throw problemError(403, 'Password errata')
    this.users.delete(entry.user.id)
    for (const [token, userId] of this.accessTokens) if (userId === entry.user.id) this.accessTokens.delete(token)
    this.cookieUserId = null
    this.auth.setToken(null)
  }

  async getSave(): Promise<SaveDto> {
    await this.delay()
    return structuredClone(this.current().save)
  }

  async startRun(r: StartRunRequest): Promise<StartRunResponse> {
    await this.delay()
    const entry = this.current()
    this.requireVerified(entry)
    if (!entry.save.unlockedCharacters.includes(r.characterId)) throw problemError(400, 'Personaggio non sbloccato')
    for (const run of this.runs.values()) if (run.userId === entry.user.id) run.ended = true
    const runId = crypto.randomUUID()
    const startedAt = Date.now()
    this.runs.set(runId, { userId: entry.user.id, characterId: r.characterId, startedAt, ended: false })
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647
    return { runId, seed, startedAt: new Date(startedAt).toISOString() }
  }

  private activeRun(entry: MockUser, runId: string): MockRun {
    const run = this.runs.get(runId)
    if (!run || run.userId !== entry.user.id) throw problemError(404, 'Run non trovata')
    if (run.ended) throw problemError(409, 'Run già conclusa')
    return run
  }

  async checkpoint(runId: string, c: CheckpointRequest): Promise<void> {
    await this.delay()
    const run = this.activeRun(this.current(), runId)
    const realSec = (Date.now() - run.startedAt) / 1000
    if (c.elapsedSec > realSec + balance.antiCheat.clockSkewSec) {
      run.ended = true
      run.flagged = true
      throw problemError(422, 'Checkpoint non plausibile')
    }
  }

  async endRun(runId: string, r: EndRunRequest): Promise<EndRunResponse> {
    await this.delay()
    const entry = this.current()
    // ending is idempotent: ENDED replays the stored outcome, FLAGGED answers flagged: true;
    // only an abandoned run (ended by a newer start) answers 409
    const known = this.runs.get(runId)
    if (known && known.userId === entry.user.id && known.ended) {
      if (known.outcome) return structuredClone(known.outcome)
      if (known.flagged) return { eurodollarsAwarded: 0, newUnlocks: [], flagged: true, save: structuredClone(entry.save) }
    }
    const run = this.activeRun(entry, runId)
    run.ended = true
    const save = entry.save
    const minutes = Math.max(1, r.durationSec / 60)
    const base = Math.min(
      r.durationSec * balance.reward.perSecond + r.kills * balance.reward.perKill,
      balance.reward.maxPerMinute * minutes,
    )
    const greed = save.ripperdoc.greed ?? 0
    const awarded = Math.round(base * (1 + greed * getRipperdoc('greed').perRank.value))
    save.eurodollars += awarded
    save.totalEurodollarsEarned += awarded
    save.totalKills += r.kills
    save.bestTimeSec = Math.max(save.bestTimeSec, Math.floor(r.durationSec))
    for (const [enemy, n] of Object.entries(r.killsByEnemy)) {
      const id = enemy as keyof SaveDto['killStats']
      save.killStats[id] = (save.killStats[id] ?? 0) + (n ?? 0)
    }
    const stat = save.characterStats[r.characterId] ?? { bestTimeSec: 0, runs: 0 }
    save.characterStats[r.characterId] = {
      bestTimeSec: Math.max(stat.bestTimeSec, Math.floor(r.durationSec)),
      runs: stat.runs + 1,
    }
    save.codex.enemies = [...new Set([...save.codex.enemies, ...r.enemiesSeen])]
    save.codex.weapons = [...new Set([...save.codex.weapons, ...r.weaponsSeen])]
    const newUnlocks: CharacterId[] = []
    for (const u of unlocks) {
      if (!save.unlockedCharacters.includes(u.characterId) && ruleMet(u.rule, save)) {
        save.unlockedCharacters.push(u.characterId)
        newUnlocks.push(u.characterId)
      }
    }
    entry.runs.push({
      id: runId,
      characterId: r.characterId,
      durationSec: r.durationSec,
      kills: r.kills,
      level: r.level,
      endedAt: new Date().toISOString(),
    })
    run.outcome = { eurodollarsAwarded: awarded, newUnlocks, flagged: false, save: structuredClone(save) }
    return structuredClone(run.outcome)
  }

  async bestRuns(): Promise<BestRunDto[]> {
    await this.delay()
    return [...this.current().runs].sort((a, b) => b.durationSec - a.durationSec).slice(0, 10)
  }

  async buyRipperdoc(id: RipperdocUpgradeId): Promise<SaveDto> {
    await this.delay()
    const entry = this.current()
    this.requireVerified(entry)
    let def
    try {
      def = getRipperdoc(id)
    } catch {
      throw problemError(404, 'Potenziamento sconosciuto')
    }
    const rank = entry.save.ripperdoc[id] ?? 0
    if (rank >= def.maxRank) throw problemError(409, 'Grado massimo raggiunto')
    const cost = ripperdocCost(def, rank)
    if (entry.save.eurodollars < cost) throw problemError(409, '€$ insufficienti')
    entry.save.eurodollars -= cost
    entry.save.ripperdoc[id] = rank + 1
    return structuredClone(entry.save)
  }
}

