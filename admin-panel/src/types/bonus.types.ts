export type BonusKind =
  | 'WELCOME'
  | 'DEPOSIT'
  | 'RELOAD'
  | 'FREE_SPIN'
  | 'CASHBACK'
  | 'LOYALTY'
  | 'NO_DEPOSIT'
  | 'MANUAL'

export type BonusRewardType = 'PERCENTAGE' | 'FIXED' | 'FREE_SPINS'
export type BonusClaimMode = 'AUTO' | 'MANUAL' | 'CODE'
export type BonusStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'

export type ConditionType =
  | 'MIN_DEPOSIT'
  | 'MIN_KYC_LEVEL'
  | 'COUNTRY_ALLOW'
  | 'COUNTRY_DENY'
  | 'NEW_USERS_ONLY'
  | 'FIRST_DEPOSIT_ONLY'
  | 'MIN_ACCOUNT_AGE_HOURS'
  | 'GAME_CATEGORY'
  | 'CUSTOM'

export interface BonusCondition {
  id?: string
  type: ConditionType
  operator?: string
  value: string
  params?: Record<string, unknown>
}

export interface AdminBonus {
  id: string
  code: string | null
  name: string
  kind: BonusKind
  rewardType: BonusRewardType
  claimMode: BonusClaimMode
  status: BonusStatus
  percentage: number | null
  maxAmount: number | null
  wagerMultiplier: number
  priority: number
  claims: number
  conditions: number
  createdAt: string
}

export interface BonusFormData {
  name: string
  description?: string
  code?: string
  kind: BonusKind
  rewardType: BonusRewardType
  claimMode: BonusClaimMode
  status: BonusStatus
  percentage?: number
  fixedAmountMinor?: number
  maxAmountMinor?: number
  minDepositMinor?: number
  freeSpinCount?: number
  freeSpinValueMinor?: number
  wagerMultiplier: number
  wagerIncludesDeposit: boolean
  maxBetMinor?: number
  expiryHours: number
  cashbackBasis?: 'NET_LOSS' | 'DEPOSIT'
  cashbackPeriodHours?: number
  allowStacking: boolean
  priority: number
  maxClaimsPerUser: number
}

export interface ClaimRow {
  id: string
  user: string
  email: string
  bonus: string
  kind: BonusKind
  status: string
  granted: number
  wagerRequired: number
  wagerProgress: number
  released: number
  createdAt: string
}

export interface BonusAnalytics {
  byStatus: Array<{ status: string; count: number }>
  byKind: Array<{ kind: string; count: number }>
  totalGranted: number
  totalReleased: number
  conversionRate: number
  openAbuseFlags: number
}

export interface AbuseFlag {
  id: string
  user: string
  email: string
  reason: string
  severity: string
  details: unknown
  resolved: boolean
  createdAt: string
}
