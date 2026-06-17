export type BonusKind =
  | 'WELCOME'
  | 'DEPOSIT'
  | 'RELOAD'
  | 'FREE_SPIN'
  | 'CASHBACK'
  | 'LOYALTY'
  | 'NO_DEPOSIT'
  | 'MANUAL'

export type UserBonusStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FORFEITED' | 'EXPIRED' | 'CANCELLED'

/** A bonus the player can claim (from /bonus/available). */
export interface AvailableBonus {
  id: string
  name: string
  description: string | null
  kind: BonusKind
  rewardType: 'PERCENTAGE' | 'FIXED' | 'FREE_SPINS'
  claimMode: 'AUTO' | 'MANUAL' | 'CODE'
  requiresCode: boolean
  percentage: number | null
  maxAmount: number | null
  minDeposit: number | null
  wagerMultiplier: number
  freeSpins: number
  eligible: boolean
  reasons: string[]
}

/** A player's granted bonus instance (from /bonus/mine, /bonus/progress). */
export interface UserBonus {
  id: string
  bonusId: string
  name: string
  kind: BonusKind
  status: UserBonusStatus
  grantedAmount: number
  wagerRequired: number
  wagerProgress: number
  wagerPercent: number
  maxConvertible: number | null
  activatedAt: string | null
  expiresAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface FreeSpinPackage {
  id: string
  gameId: string | null
  totalSpins: number
  usedSpins: number
  remainingSpins: number
  spinValue: number
  winnings: number
  status: string
  expiresAt: string | null
}

export interface Promotion {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  bannerUrl: string | null
  status: string
  sortOrder: number
  content: unknown
  startsAt: string | null
  endsAt: string | null
  bonus?: { id: string; name: string; kind: BonusKind } | null
}

/** Socket payloads. */
export interface BonusProgressEvent {
  userBonusId: string
  progressMinor: number
  requiredMinor: number
  percent: number
}
export interface BonusCompletedEvent {
  userBonusId: string
  releasedMinor: number
}
export interface BonusEndedEvent {
  userBonusId: string
  reason: string
}
