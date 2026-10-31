import {
  API,
  type AuthResponse,
  type BestRunDto,
  type CheckpointRequest,
  type DeleteAccountRequest,
  type EndRunRequest,
  type EndRunResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type MessageResponse,
  type RegisterRequest,
  type ResetPasswordRequest,
  type SaveDto,
  type StartRunRequest,
  type StartRunResponse,
  type UserDto,
  type VerifyEmailRequest,
} from '@shared/api-contract'
import type { RipperdocUpgradeId } from '@shared/types'
import type { AuthBridge } from './auth'
import { createHttp } from './http'

export interface ApiClient {
  register(r: RegisterRequest): Promise<MessageResponse>
  verifyEmail(r: VerifyEmailRequest): Promise<void>
  resendVerification(): Promise<void>
  /** Also stores the new access token in the auth bridge. */
  login(r: LoginRequest): Promise<AuthResponse>
  /** Also stores the new access token in the auth bridge. */
  refresh(): Promise<AuthResponse>
  logout(): Promise<void>
  logoutAll(): Promise<void>
  forgotPassword(r: ForgotPasswordRequest): Promise<MessageResponse>
  resetPassword(r: ResetPasswordRequest): Promise<void>
  me(): Promise<UserDto>
  exportData(): Promise<Blob>
  deleteAccount(r: DeleteAccountRequest): Promise<void>
  getSave(): Promise<SaveDto>
  startRun(r: StartRunRequest): Promise<StartRunResponse>
  checkpoint(runId: string, c: CheckpointRequest): Promise<void>
  endRun(runId: string, r: EndRunRequest): Promise<EndRunResponse>
  bestRuns(): Promise<BestRunDto[]>
  buyRipperdoc(id: RipperdocUpgradeId): Promise<SaveDto>
}

export function createRealApi(deps: { auth: AuthBridge; fetchImpl?: typeof fetch }): ApiClient {
  const { auth } = deps

  async function doRefresh(): Promise<AuthResponse> {
    const res = await http.request<AuthResponse>(API.refresh, { method: 'POST', csrf: true })
    auth.setToken(res.accessToken)
    return res
  }

  const http = createHttp({
    getToken: auth.getToken,
    refresh: async () => (await doRefresh()).accessToken,
    onAuthLost: auth.authLost,
    fetchImpl: deps.fetchImpl,
  })

  const bearer = { auth: true } as const
  const post = { method: 'POST', auth: true } as const

  return {
    register: (r) => http.request(API.register, { method: 'POST', body: r }),
    verifyEmail: (r) => http.request(API.verifyEmail, { method: 'POST', body: r }),
    resendVerification: () => http.request(API.resendVerification, post),
    async login(r) {
      const res = await http.request<AuthResponse>(API.login, { method: 'POST', body: r })
      auth.setToken(res.accessToken)
      return res
    },
    refresh: doRefresh,
    async logout() {
      try {
        await http.request(API.logout, { method: 'POST', csrf: true })
      } finally {
        auth.setToken(null)
      }
    },
    async logoutAll() {
      await http.request(API.logoutAll, post)
      auth.setToken(null)
    },
    forgotPassword: (r) => http.request(API.forgotPassword, { method: 'POST', body: r }),
    resetPassword: (r) => http.request(API.resetPassword, { method: 'POST', body: r }),
    me: () => http.request(API.me, bearer),
    exportData: () => http.request(API.meExport, { auth: true, responseType: 'blob' }),
    async deleteAccount(r) {
      await http.request(API.me, { method: 'DELETE', auth: true, body: r })
      auth.setToken(null)
    },
    getSave: () => http.request(API.save, bearer),
    startRun: (r) => http.request(API.runStart, { ...post, body: r }),
    checkpoint: (id, c) => http.request(API.runCheckpoint(id), { ...post, body: c }),
    endRun: (id, r) => http.request(API.runEnd(id), { ...post, body: r }),
    bestRuns: () => http.request(API.runsBest, bearer),
    buyRipperdoc: (id) => http.request(API.ripperdocBuy(id), post),
  }
}
