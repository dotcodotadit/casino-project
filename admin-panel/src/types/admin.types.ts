// Admin domain types. Mirror the backend Prisma models where relevant.

export type UserRole = 'PLAYER' | 'ADMIN' | 'SUPPORT'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'SELF_EXCLUDED'
export type KycLevel = 'NONE' | 'BASIC' | 'FULL'
export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface AdminUser {
  id: string
  email: string
  username: string
  phone: string | null
  role: UserRole
  status: UserStatus
  kycLevel: KycLevel
  kycStatus: KycStatus
  balanceMinor: number
  totalDepositedMinor: number
  totalWithdrawnMinor: number
  createdAt: string
  lastLoginAt: string | null
}

export type GameType = 'SLOTS' | 'ROULETTE' | 'BLACKJACK'

export interface GameConfig {
  id: string
  game: GameType
  displayName: string
  rtp: number // fraction, e.g. 0.96
  enabled: boolean
  maintenance: boolean
  minBetMinor: number
  maxBetMinor: number
  jackpotMinor: number
  jackpotEnabled: boolean
}

export type TxType = 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'PAYOUT' | 'BONUS'
export type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface FinanceTx {
  id: string
  userId: string
  username: string
  type: TxType
  status: TxStatus
  amountMinor: number
  method: string | null
  createdAt: string
}

export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface TicketMessage {
  id: string
  author: 'user' | 'agent'
  body: string
  createdAt: string
}

export interface SupportTicket {
  id: string
  subject: string
  username: string
  status: TicketStatus
  priority: TicketPriority
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
}

export interface ServerSeed {
  id: string
  seedHash: string
  seed: string | null // revealed only after rotation
  active: boolean
  roundsPlayed: number
  createdAt: string
  rotatedAt: string | null
}

export interface FairRound {
  id: string
  username: string
  game: GameType
  serverSeed: string // revealed
  serverSeedHash: string
  clientSeed: string
  nonce: number
  stakeMinor: number
  payoutMinor: number
  createdAt: string
}

// Dashboard analytics
export interface DashboardKpis {
  revenueMinor: number
  revenueDeltaPct: number
  activeUsers: number
  activeUsersDeltaPct: number
  ggrMinor: number // gross gaming revenue
  ggrDeltaPct: number
  rtpRealtime: number // fraction
  pendingWithdrawals: number
  pendingKyc: number
  openTickets: number
}

export interface TimeseriesPoint {
  date: string
  revenue: number // major units (USD)
  deposits: number
  withdrawals: number
}

export interface GamePerformance {
  game: GameType
  betsMinor: number
  ggrMinor: number
  rtp: number
}
