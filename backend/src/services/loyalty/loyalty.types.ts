import type { VipProgress, VipLevel, UserMission, Mission } from '@prisma/client'

/**
 * Loyalty engine settings — all hot-reloadable via the LoyaltySetting table so
 * point rates / anti-abuse / downgrade policy change WITHOUT a redeploy.
 */
export const LOYALTY_SETTING_KEYS = {
  POINTS: 'points',
  ABUSE: 'abuse',
  DOWNGRADE: 'downgrade',
  WIN_BIG: 'winBig',
} as const

export interface PointConfig {
  // STATUS (tier XP) + LOYALTY (redeemable) points earned per unit of turnover.
  // Earned points = floor(stakeMinor * categoryWeight * rate * tierMultiplier).
  loyaltyPerStakeMinor: number // e.g. 0.001 → 1 pt per $10 wagered ($10=1000 minor)
  statusPerStakeMinor: number
  // Points per deposit (minor units).
  loyaltyPerDepositMinor: number
  statusPerDepositMinor: number
  // Per-category contribution weights (game category → weight).
  categoryWeights: Record<string, number>
}

export const DEFAULT_POINT_CONFIG: PointConfig = {
  // 1 loyalty + 1 status point per $1 (100 minor) of weighted turnover.
  loyaltyPerStakeMinor: 0.01,
  statusPerStakeMinor: 0.01,
  // 5 points per $1 deposited.
  loyaltyPerDepositMinor: 0.05,
  statusPerDepositMinor: 0.05,
  categoryWeights: {
    SLOTS: 1,
    CRASH: 1,
    FISHING: 1,
    LOTTERY: 1,
    TABLE: 0.5, // blackjack/roulette contribute less (lower house edge)
    LIVE: 0.5,
    OTHER: 0.5,
  },
}

export interface LoyaltyAbuseConfig {
  enabled: boolean
  // Max points a single user may earn within the window before flagging.
  maxPointsPerWindow: number
  windowHours: number
  // Flag when a high share of bets sit at/below this stake (point farming).
  minStakeFarmMinor: number
  minStakeFarmRatio: number
}

export const DEFAULT_ABUSE_CONFIG: LoyaltyAbuseConfig = {
  enabled: true,
  maxPointsPerWindow: 1_000_000,
  windowHours: 24,
  minStakeFarmMinor: 20,
  minStakeFarmRatio: 0.85,
}

export interface DowngradeConfig {
  enabled: boolean
  // Days a user may stay below keepPoints before being downgraded.
  graceDays: number
  // Length of the STATUS-point review period in days.
  reviewPeriodDays: number
}

export const DEFAULT_DOWNGRADE_CONFIG: DowngradeConfig = {
  enabled: true,
  graceDays: 7,
  reviewPeriodDays: 30,
}

export interface WinBigConfig {
  // A payout is "big" when payout/stake >= multiplier OR payout >= absMinor.
  multiplier: number
  absMinor: number
  // Bonus status points awarded for a big win.
  bonusStatusPoints: number
}

export const DEFAULT_WIN_BIG_CONFIG: WinBigConfig = {
  multiplier: 50,
  absMinor: 100_00,
  bonusStatusPoints: 50,
}

/** Frontend-safe VIP progress view (with the resolved tier + next-tier delta). */
export interface VipProgressView {
  level: number
  levelName: string
  color: string | null
  icon: string | null
  loyaltyPoints: number
  statusPoints: number
  lifetimePoints: number
  pointMultiplier: number
  cashbackPct: number
  nextLevel: { level: number; name: string; requiredPoints: number } | null
  // Progress toward the next tier as 0..100.
  progressPercent: number
  pointsToNext: number
  graceEndsAt: string | null
  lastLevelUpAt: string | null
}

export function toVipProgressView(
  p: VipProgress & { level: VipLevel },
  next: VipLevel | null,
): VipProgressView {
  const status = Number(p.statusPoints)
  const curReq = Number(p.level.requiredPoints)
  const nextReq = next ? Number(next.requiredPoints) : curReq
  const span = Math.max(1, nextReq - curReq)
  const into = Math.max(0, status - curReq)
  const progressPercent = next ? Math.min(100, Math.round((into / span) * 100)) : 100
  return {
    level: p.level.level,
    levelName: p.level.name,
    color: p.level.color,
    icon: p.level.icon,
    loyaltyPoints: Number(p.loyaltyPoints),
    statusPoints: status,
    lifetimePoints: Number(p.lifetimePoints),
    pointMultiplier: p.level.pointMultiplier,
    cashbackPct: p.level.cashbackPct,
    nextLevel: next ? { level: next.level, name: next.name, requiredPoints: nextReq } : null,
    progressPercent,
    pointsToNext: next ? Math.max(0, nextReq - status) : 0,
    graceEndsAt: p.graceEndsAt?.toISOString() ?? null,
    lastLevelUpAt: p.lastLevelUpAt?.toISOString() ?? null,
  }
}

export interface UserMissionView {
  id: string
  key: string
  name: string
  description: string | null
  type: string
  metric: string
  status: string
  progress: number
  target: number
  percent: number
  rewardPoints: number
  expiresAt: string | null
}

export function toUserMissionView(um: UserMission & { mission: Mission }): UserMissionView {
  const progress = Number(um.progress)
  const target = Number(um.target)
  return {
    id: um.id,
    key: um.mission.key,
    name: um.mission.name,
    description: um.mission.description,
    type: um.mission.type,
    metric: um.mission.metric,
    status: um.status,
    progress,
    target,
    percent: target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0,
    rewardPoints: Number(um.mission.rewardPoints),
    expiresAt: um.expiresAt?.toISOString() ?? null,
  }
}
