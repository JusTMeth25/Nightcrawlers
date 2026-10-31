import { createRealApi, type ApiClient } from './ApiClient'
import { createAuthBridge } from './auth'
import { MockApi } from './mock/MockApi'

export type { ApiClient } from './ApiClient'
export type { AuthBridge } from './auth'
export { ApiError, isApiError } from './errors'

export const isMockApi = import.meta.env.VITE_API_MOCK === 'true'

/** Access token holder (memory only). */
export const authBridge = createAuthBridge()

export const api: ApiClient = isMockApi ? new MockApi({ auth: authBridge }) : createRealApi({ auth: authBridge })
