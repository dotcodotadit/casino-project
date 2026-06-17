import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { conditionsService } from './conditions.service.js'

export interface AbuseSignal {
  reason: 'DUP_IP' | 'DUP_DEVICE' | 'MIN_BET_PATTERN' | 'VELOCITY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  details?: Record<string, unknown>
}

export interface AbuseVerdict {
  blocked: boolean
  signals: AbuseSignal[]
}

/**
 * Bonus-abuse detection. Runs cheap structural checks at grant time (shared IP /
 * device, claim velocity) and a behavioural check (min-bet farming) callable
 * after play. All signals are persisted as BonusAbuseFlag rows for review; a
 * HIGH signal blocks the grant when configured.
 *
 * Heuristics are intentionally conservative — this is a deterrent + audit trail,
 * not a perfect classifier. Thresholds are hot-reloadable via BonusSetting.
 */
export const abuseService = {
  /** Pre-grant structural screen (IP/device sharing + claim velocity). */
  async screenGrant(input: {
    userId: string
    bonusId: string
    ipAddress?: string
    deviceFingerprint?: string
  }): Promise<AbuseVerdict> {
    const cfg = await conditionsService.abuseSettings()
    if (!cfg.enabled) return { blocked: false, signals: [] }

    const signals: AbuseSignal[] = []

    // ── Shared IP across distinct accounts (via Session.ipAddress) ──
    if (input.ipAddress) {
      const accounts = await prisma.session.findMany({
        where: { ipAddress: input.ipAddress },
        select: { userId: true },
        distinct: ['userId'],
        take: cfg.maxAccountsPerIp + 5,
      })
      const others = accounts.filter((a) => a.userId !== input.userId).length
      if (others + 1 > cfg.maxAccountsPerIp) {
        signals.push({
          reason: 'DUP_IP',
          severity: others + 1 > cfg.maxAccountsPerIp * 2 ? 'HIGH' : 'MEDIUM',
          details: { ipAddress: input.ipAddress, accounts: others + 1 },
        })
      }
    }

    // ── Shared device fingerprint ──
    if (input.deviceFingerprint) {
      const accounts = await prisma.session.findMany({
        where: { deviceFingerprint: input.deviceFingerprint },
        select: { userId: true },
        distinct: ['userId'],
        take: cfg.maxAccountsPerDevice + 5,
      })
      const others = accounts.filter((a) => a.userId !== input.userId).length
      if (others + 1 > cfg.maxAccountsPerDevice) {
        signals.push({
          reason: 'DUP_DEVICE',
          severity: 'HIGH',
          details: { deviceFingerprint: input.deviceFingerprint, accounts: others + 1 },
        })
      }
    }

    // ── Claim velocity ──
    const since = new Date(Date.now() - cfg.velocityWindowHours * 3_600_000)
    const recentClaims = await prisma.userBonus.count({
      where: { userId: input.userId, createdAt: { gte: since } },
    })
    if (recentClaims >= cfg.velocityMaxClaims) {
      signals.push({
        reason: 'VELOCITY',
        severity: 'MEDIUM',
        details: { recentClaims, windowHours: cfg.velocityWindowHours },
      })
    }

    await this.persist(input.userId, input.bonusId, signals)

    const blocked = cfg.blockOnHigh && signals.some((s) => s.severity === 'HIGH')
    if (blocked) logger.warn({ userId: input.userId, signals }, 'bonus grant blocked by abuse screen')
    return { blocked, signals }
  },

  /**
   * Behavioural check: detect min-bet "wagering farming" where a player only
   * places near-max-bet/min-stake bets to clear wagering with minimal exposure.
   */
  async screenBettingPattern(userBonusId: string): Promise<AbuseSignal | null> {
    const cfg = await conditionsService.abuseSettings()
    if (!cfg.enabled) return null

    const ub = await prisma.userBonus.findUnique({
      where: { id: userBonusId },
      include: { bonus: true, contributions: { take: 200, orderBy: { createdAt: 'desc' } } },
    })
    if (!ub || ub.contributions.length < 20) return null

    const maxBet = ub.bonus.maxBetMinor ? Number(ub.bonus.maxBetMinor) : null
    if (!maxBet) return null

    // Share of bets sitting at/above 95% of the max-bet cap.
    const nearMax = ub.contributions.filter((c) => Number(c.stakeMinor) >= maxBet * 0.95).length
    const ratio = nearMax / ub.contributions.length
    if (ratio >= cfg.minBetPatternRatio) {
      const signal: AbuseSignal = {
        reason: 'MIN_BET_PATTERN',
        severity: 'MEDIUM',
        details: { ratio: Number(ratio.toFixed(2)), samples: ub.contributions.length },
      }
      await this.persist(ub.userId, ub.bonusId, [signal])
      return signal
    }
    return null
  },

  async persist(userId: string, bonusId: string | null, signals: AbuseSignal[]): Promise<void> {
    if (signals.length === 0) return
    await prisma.bonusAbuseFlag.createMany({
      data: signals.map((s) => ({
        userId,
        bonusId: bonusId ?? undefined,
        reason: s.reason,
        severity: s.severity,
        details: (s.details as object) ?? undefined,
      })),
    })
  },
}
