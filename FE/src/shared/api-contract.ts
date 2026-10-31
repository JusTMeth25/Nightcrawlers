// REST contract between FE and BE. Mirrors docs/api/openapi.yaml (source of truth).
import type {
  CharacterId,
  EnemyId,
  RipperdocUpgradeId,
  RunCheckpoint,
  RunResult,
  WeaponId,
} from './types'

export interface UserDto {
  id: string
  username: string
  email: string
  emailVerified: boolean
  createdAt: string
}
export interface AuthResponse {
  accessToken: string
  expiresInSec: number
  user: UserDto
}
export interface RegisterRequest {
  username: string
  email: string
  password: string
}
/** login accepts username or email */
export interface LoginRequest {
  login: string
  password: string
}
export interface VerifyEmailRequest {
  token: string
}
export interface ForgotPasswordRequest {
  email: string
}
export interface ResetPasswordRequest {
  token: string
  newPassword: string
}
export interface DeleteAccountRequest {
  password: string
}
export interface CharacterStatDto {
  bestTimeSec: number
  runs: number
}
export interface SaveDto {
  eurodollars: number
  totalEurodollarsEarned: number
  totalKills: number
  bestTimeSec: number
  unlockedCharacters: CharacterId[]
  ripperdoc: Partial<Record<RipperdocUpgradeId, number>>
  killStats: Partial<Record<EnemyId, number>>
  characterStats: Partial<Record<CharacterId, CharacterStatDto>>
  codex: { enemies: EnemyId[]; weapons: WeaponId[] }
}
export interface StartRunRequest {
  characterId: CharacterId
}
export interface StartRunResponse {
  runId: string
  seed: number
  startedAt: string
}
export type CheckpointRequest = RunCheckpoint
export type EndRunRequest = Omit<RunResult, 'runId'>
export interface EndRunResponse {
  eurodollarsAwarded: number
  newUnlocks: CharacterId[]
  flagged: boolean
  save: SaveDto
}
export interface BestRunDto {
  id: string
  characterId: CharacterId
  durationSec: number
  kills: number
  level: number
  endedAt: string
}
export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, string>
}
export interface MessageResponse {
  message: string
}

export const CSRF_COOKIE = 'XSRF-TOKEN'
export const CSRF_HEADER = 'X-CSRF-Token'

export const API = {
  register: '/api/auth/register',
  verifyEmail: '/api/auth/verify-email',
  resendVerification: '/api/auth/resend-verification',
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  logoutAll: '/api/auth/logout-all',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  me: '/api/me',
  meExport: '/api/me/export',
  save: '/api/save',
  runStart: '/api/runs/start',
  runCheckpoint: (id: string) => `/api/runs/${encodeURIComponent(id)}/checkpoint`,
  runEnd: (id: string) => `/api/runs/${encodeURIComponent(id)}/end`,
  runsBest: '/api/runs/best',
  ripperdocBuy: (id: RipperdocUpgradeId) => `/api/ripperdoc/${id}/buy`,
} as const
