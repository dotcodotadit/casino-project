import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { bonusBus } from '../../events/bonus.events.js'
import { loyaltySettings } from './loyalty.settings.js'

/**
 * Level-up / downgrade engine.
 *
 * Promotion: the highest tier whose requiredPoints <= statusPoints is the
 * earned tier. If above the current tier, promote (instant, no grace).
 *
 * Demotion: if statusPoints fell below the *current* tier's keepPoints, start a
 * grace window (graceDays). If still below when the window elapses (handled by
 * the scheduler calling `applyDueDowngrades`), drop one or more tiers.
 *
 * All tier writes are optimistic-locked on VipProgress.version. Events emitted:
 * `vip.levelup` / `vip.downgrade`.
 */
export const levelUpService = {
  /**
   * Re-evaluate a user's tier after a point change. Promotes immediately when
   * eligible; arms/clears the downgrade grace window otherwise. Returns the new
   * level number if a promotion happened.
   */
  async evaluate(userId: string): Promise<{ promoted: boolean; level: number } | null> {
    const levels = await prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
    if (levels.length === 0) return null

    const out = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const p = await tx.vipProgress.findUnique({ where: { userId }, include: { level: true } })
          if (!p) return null

          const status = p.statusPoints
          // Earned tier = highest whose requiredPoints <= status.
          let earned = levels[0]
          for (const l of levels) {
            if (status >= l.requiredPoints) earned = l
          }

          // ── Promotion (instant) ──
          if (earned.level > p.level.level) {
            const upd = await tx.vipProgress.updateMany({
              where: { id: p.id, version: p.version },
              data: {
                levelId: earned.id,
                version: { increment: 1 },
                lastLevelUpAt: new Date(),
                graceEndsAt: null,
                pendingDowngradeLevelId: null,
              },
            })
            if (upd.count === 0) throw { code: 'WALLET_CONFLICT', retriable: true }
            await tx.loyaltyPointTransaction.create({
              data: {
                userId,
                type: 'STATUS',
                source: 'LEVEL_UP',
                amount: 0n,
                balanceAfter: status,
                reference: `levelup:${userId}:${earned.level}:${Date.now()}`,
                metadata: { from: p.level.level, to: earned.level },
              },
            })
            return { kind: 'promote' as const, from: p.level.level, to: earned.level, name: earned.name }
          }

          // ── Demotion grace handling ──
          // Below the floor to keep the current tier?
          if (status < p.level.keepPoints && earned.level < p.level.level) {
            if (!p.graceEndsAt) {
              const cfg = await loyaltySettings.downgradeConfig()
              if (!cfg.enabled) return null
              const graceEndsAt = new Date(Date.now() + cfg.graceDays * 86_400_000)
              await tx.vipProgress.updateMany({
                where: { id: p.id, version: p.version },
                data: { graceEndsAt, pendingDowngradeLevelId: earned.id, version: { increment: 1 } },
              })
              logger.info({ userId, graceEndsAt }, 'downgrade grace armed')
            }
            return null
          }

          // Recovered above keep floor → clear any armed grace.
          if (p.graceEndsAt && status >= p.level.keepPoints) {
            await tx.vipProgress.updateMany({
              where: { id: p.id, version: p.version },
              data: { graceEndsAt: null, pendingDowngradeLevelId: null, version: { increment: 1 } },
            })
          }
          return null
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (out?.kind === 'promote') {
      bonusBus.publish('vip.levelup', {
        userId,
        fromLevel: out.from,
        toLevel: out.to,
        levelName: out.name,
      })
      logger.info({ userId, to: out.to }, 'VIP level up')
      return { promoted: true, level: out.to }
    }
    return null
  },

  /**
   * Scheduler entry: apply downgrades whose grace window has elapsed. Drops each
   * affected user to the tier their STATUS points currently earn.
   */
  async applyDueDowngrades(now = new Date()): Promise<number> {
    const due = await prisma.vipProgress.findMany({
      where: { graceEndsAt: { lt: now, not: null } },
      include: { level: true },
    })
    const levels = await prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
    let count = 0

    for (const p of due) {
      let earned = levels[0]
      for (const l of levels) if (p.statusPoints >= l.requiredPoints) earned = l
      if (earned.level >= p.level.level) {
        // Recovered before the sweep — just clear grace.
        await prisma.vipProgress.update({
          where: { id: p.id },
          data: { graceEndsAt: null, pendingDowngradeLevelId: null },
        })
        continue
      }
      try {
        await prisma.vipProgress.update({
          where: { id: p.id },
          data: {
            levelId: earned.id,
            graceEndsAt: null,
            pendingDowngradeLevelId: null,
            periodStartedAt: now,
          },
        })
        bonusBus.publish('vip.downgrade', {
          userId: p.userId,
          fromLevel: p.level.level,
          toLevel: earned.level,
          levelName: earned.name,
        })
        count++
      } catch (err) {
        logger.error({ err, userId: p.userId }, 'downgrade failed')
      }
    }
    if (count) logger.info({ count }, 'VIP downgrades applied')
    return count
  },
}
