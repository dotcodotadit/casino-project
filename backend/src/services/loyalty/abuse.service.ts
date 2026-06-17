import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { loyaltySettings } from './loyalty.settings.js'

/**
 * Point-farming detection. Lightweight checks reusing the existing
 * BonusAbuseFlag table (reason prefixed `LOYALTY_`) so the admin abuse review
 * surfaces both bonus and loyalty signals. Conservative + auditable — a
 * deterrent, not a hard blocker (points already accrued via the immutable
 * ledger; flags drive manual review / clawback).
 */
export const loyaltyAbuseService = {
  /**
   * Check whether a user has earned an abnormal amount of points within the
   * window (velocity) — called opportunistically after large accruals.
   */
  async checkVelocity(userId: string): Promise<void> {
    const cfg = await loyaltySettings.abuseConfig()
    if (!cfg.enabled) return
    const since = new Date(Date.now() - cfg.windowHours * 3_600_000)
    const agg = await prisma.loyaltyPointTransaction.aggregate({
      where: { userId, type: 'STATUS', amount: { gt: 0 }, createdAt: { gte: since } },
      _sum: { amount: true },
    })
    const earned = Number(agg._sum.amount ?? 0n)
    if (earned > cfg.maxPointsPerWindow) {
      await this.flag(userId, 'LOYALTY_VELOCITY', 'MEDIUM', { earned, windowHours: cfg.windowHours })
    }
  },

  async flag(userId: string, reason: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', details?: Record<string, unknown>) {
    try {
      await prisma.bonusAbuseFlag.create({ data: { userId, reason, severity, details: details as object } })
      logger.warn({ userId, reason, severity }, 'loyalty abuse flag raised')
    } catch (err) {
      logger.error({ err, userId }, 'failed to persist loyalty abuse flag')
    }
  },
}
