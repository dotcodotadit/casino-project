export type ProviderCode = 'PGSOFT' | 'PRAGMATIC' | 'EVOLUTION' | 'JILI'
export type ProviderStatus = 'ACTIVE' | 'DISABLED' | 'MAINTENANCE'

export interface AdminProvider {
  id: string
  code: ProviderCode
  name: string
  status: ProviderStatus
  aggregator: string | null
  supportedCurrencies: string[]
  callbackIpWhitelist: string[]
  hasCredentials: boolean
  gamesCount: number
}

export interface AdminGame {
  id: string
  provider: ProviderCode
  externalId: string
  name: string
  category: string
  rtp: number | null
  enabled: boolean
  maintenance: boolean
}

export interface AdminSession {
  id: string
  user: string
  provider: ProviderCode
  game: string | null
  currency: string
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
}

export type ProviderTxType = 'BET' | 'WIN' | 'REFUND' | 'ROLLBACK' | 'BONUS'

export interface AdminProviderTx {
  id: string
  user: string
  provider: ProviderCode
  type: ProviderTxType
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'
  roundId: string | null
  providerTxId: string
  amountMinor: number
  balanceAfter: number | null
  createdAt: string
}

export type CallbackStatus = 'RECEIVED' | 'PROCESSED' | 'REJECTED' | 'FAILED'

export interface AdminCallback {
  id: string
  providerCode: ProviderCode
  action: string
  ipAddress: string | null
  signatureValid: boolean
  status: CallbackStatus
  idempotencyKey: string | null
  error: string | null
  attempts: number
  createdAt: string
}
