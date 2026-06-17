import type { Bonus, BonusCondition, UserBonus, Prisma } from '@prisma/client'

/** Default per-game-category wagering contribution weights. */
export const DEFAULT_CATEGORY_WEIGHTS: Record<string, number> = {
  SLOTS: 1,
  CRASH: 1,
  FISHING: 1,
  LOTTERY: 1,
  TABLE: 0.1,
  LIVE: 0.1,
  OTHER: 0.2,
}

/** Bonus engine setting keys (hot-reloadable via BonusSetting). */
export const BONUS_SETTING_KEYS = {
  ABUSE: 'abuse',
  CATEGORY_WEIGHTS: 'categoryWeights',
  GLOBAL: 'global',
} as const

export interface AbuseSettings {
  enabled: boolean
  maxAccountsPerIp: number
  maxAccountsPerDevice: number
  minBetPatternRatio: number // share of bets at/under maxBet that flags farming
  velocityWindowHours: number
  velocityMaxClaims: number
  blockOnHigh: boolean // block grant when a HIGH-severity flag is raised
}

export const DEFAULT_ABUSE: AbuseSettings = {
  enabled: true,
  maxAccountsPerIp: 2,
  maxAccountsPerDevice: 1,
  minBetPatternRatio: 0.8,
  velocityWindowHours: 24,
  velocityMaxClaims: 3,
  blockOnHigh: true,
}

export interface GlobalBonusSettings {
  maxActiveBonusesPerUser: number
  defaultExpiryHours: number
}

export const DEFAULT_GLOBAL: GlobalBonusSettings = {
  maxActiveBonusesPerUser: 1,
  defaultExpiryHours: 168,
}

export type BonusWithConditions = Bonus & { conditions: BonusCondition[] }

export interface GrantContext {
  userId: string
  triggerAmountMinor?: number
  ipAddress?: string
  deviceFingerprint?: string
  /** Idempotency anchor (e.g. deposit tx id) — prevents double-grant. */
  grantKey?: string
  actorId?: string
}

export interface GrantResult {
  userBonus: UserBonus
  grantedAmountMinor: number
  wagerRequiredMinor: number
}

/** A serialized, frontend-safe view of a UserBonus + its template. */
export interface UserBonusView {
  id: string
  bonusId: string
  name: string
  kind: string
  status: string
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

export function toUserBonusView(ub: UserBonus & { bonus: Bonus }): UserBonusView {
  const required = Number(ub.wagerRequiredMinor)
  const progress = Number(ub.wagerProgressMinor)
  return {
    id: ub.id,
    bonusId: ub.bonusId,
    name: ub.bonus.name,
    kind: ub.bonus.kind,
    status: ub.status,
    grantedAmount: Number(ub.grantedAmountMinor),
    wagerRequired: required,
    wagerProgress: progress,
    wagerPercent: required > 0 ? Math.min(100, Math.round((progress / required) * 100)) : 100,
    maxConvertible: ub.maxConvertibleMinor != null ? Number(ub.maxConvertibleMinor) : null,
    activatedAt: ub.activatedAt?.toISOString() ?? null,
    expiresAt: ub.expiresAt?.toISOString() ?? null,
    completedAt: ub.completedAt?.toISOString() ?? null,
    createdAt: ub.createdAt.toISOString(),
  }
}

export type JsonObject = Prisma.JsonObject
