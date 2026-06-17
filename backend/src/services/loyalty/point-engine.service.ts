import { Prisma, LoyaltyPointType, LoyaltyPointSource } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'
import { bonusBus } from '../../events/bonus.events.js'
import { loyaltySettings } from './loyalty.settings.js'

type Tx = Prisma.TransactionClient

/**
 * Point engine — the atomic, idempotent core of the loyalty system.
 *
 * Mirrors the wallet/bonus ledger: every point movement is an immutable
 * LoyaltyPointTransaction row plus an optimistic-locked update of VipProgress,
 * inside a SERIALIZABLE transaction wrapped in withRetry. Idempotency is keyed
 * by `reference` (unique), so replaying a `bet.settled` event never double-credits.
 *
 * STATUS points drive tier (checked by level-up.service after each accrual);
 * LOYALTY points are the redeemable balance spent in the VIP shop.
 */

export interface EarnInput {
  userId: string
  loyaltyPoints: number
  statusPoints: number
  source: LoyaltyPointSource
  reference?: string // idempotency anchor
  metadata?: Prisma.InputJsonValue
}

export interface EarnResult {
  applied: boolean // false on idempotent replay
  loyaltyBalance: number
  statusPoints: number
  lifetimePoints: number
}

/** Ensure a VipProgress row exists for a user (seeded at the lowest tier). */
async function ensureProgress(tx: Tx, userId: string) {
  const existing = await tx.vipProgress.findUnique({ where: { userId } })
  if (existing) return existing
  const lowest = await tx.vipLevel.findFirst({ orderBy: { level: 'asc' } })
  if (!lowest) throw AppError.unprocessable('No VIP levels configured', 'NO_VIP_LEVELS')
  return tx.vipProgress.create({ data: { userId, levelId: lowest.id } })
}

export const pointEngineService = {
  ensureProgress: (userId: string) => prisma.$transaction((tx) => ensureProgress(tx, userId)),

  /**
   * Compute points for a turnover event using the (hot-reloadable) point config
   * and the user's current tier multiplier. Pure — no side effects.
   */
  async computeBetPoints(stakeMinor: number, gameCategory: string, tierMultiplier: number) {
    const cfg = await loyaltySettings.pointConfig()
    const weight = cfg.categoryWeights[gameCategory?.toUpperCase()] ?? cfg.categoryWeights.OTHER ?? 1
    const base = stakeMinor * weight * tierMultiplier
    return {
      loyaltyPoints: Math.floor(base * cfg.loyaltyPerStakeMinor),
      statusPoints: Math.floor(base * cfg.statusPerStakeMinor),
      weight,
    }
  },

  async computeDepositPoints(amountMinor: number, tierMultiplier: number) {
    const cfg = await loyaltySettings.pointConfig()
    const base = amountMinor * tierMultiplier
    return {
      loyaltyPoints: Math.floor(base * cfg.loyaltyPerDepositMinor),
      statusPoints: Math.floor(base * cfg.statusPerDepositMinor),
    }
  },

  /**
   * Atomically credit points. Idempotent per `reference`. Bumps both the
   * redeemable LOYALTY balance and the STATUS/lifetime accumulators, writing one
   * ledger row per point type. Emits `points.earned`; the caller (or level-up
   * service) then evaluates tier changes.
   */
  async earn(input: EarnInput): Promise<EarnResult> {
    if (input.loyaltyPoints <= 0 && input.statusPoints <= 0) {
      const p = await this.ensureProgress(input.userId)
      return {
        applied: false,
        loyaltyBalance: Number(p.loyaltyPoints),
        statusPoints: Number(p.statusPoints),
        lifetimePoints: Number(p.lifetimePoints),
      }
    }

    const result = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // Idempotent replay guard — the LOYALTY row carries the reference.
          if (input.reference) {
            const dup = await tx.loyaltyPointTransaction.findUnique({ where: { reference: input.reference } })
            if (dup) {
              const p = await ensureProgress(tx, input.userId)
              return { applied: false, p }
            }
          }

          const progress = await ensureProgress(tx, input.userId)
          const newLoyalty = progress.loyaltyPoints + BigInt(input.loyaltyPoints)
          const newStatus = progress.statusPoints + BigInt(input.statusPoints)
          const newLifetime = progress.lifetimePoints + BigInt(Math.max(0, input.statusPoints))

          // Optimistic-locked progress update.
          const upd = await tx.vipProgress.updateMany({
            where: { id: progress.id, version: progress.version },
            data: {
              loyaltyPoints: newLoyalty,
              statusPoints: newStatus,
              lifetimePoints: newLifetime,
              version: { increment: 1 },
              lastActivityAt: new Date(),
            },
          })
          if (upd.count === 0) throw AppError.conflict('Concurrent point update — retry', 'WALLET_CONFLICT')

          // Ledger rows (one per non-zero point type). LOYALTY row owns the
          // idempotency reference; STATUS row derives a suffixed reference.
          if (input.loyaltyPoints > 0) {
            await tx.loyaltyPointTransaction.create({
              data: {
                userId: input.userId,
                type: LoyaltyPointType.LOYALTY,
                source: input.source,
                amount: BigInt(input.loyaltyPoints),
                balanceAfter: newLoyalty,
                reference: input.reference,
                metadata: input.metadata,
              },
            })
          }
          if (input.statusPoints > 0) {
            await tx.loyaltyPointTransaction.create({
              data: {
                userId: input.userId,
                type: LoyaltyPointType.STATUS,
                source: input.source,
                amount: BigInt(input.statusPoints),
                balanceAfter: newStatus,
                reference: input.reference ? `${input.reference}:status` : undefined,
                metadata: input.metadata,
              },
            })
          }

          return {
            applied: true,
            p: { ...progress, loyaltyPoints: newLoyalty, statusPoints: newStatus, lifetimePoints: newLifetime },
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    const out: EarnResult = {
      applied: result.applied,
      loyaltyBalance: Number(result.p.loyaltyPoints),
      statusPoints: Number(result.p.statusPoints),
      lifetimePoints: Number(result.p.lifetimePoints),
    }

    if (result.applied) {
      bonusBus.publish('points.earned', {
        userId: input.userId,
        loyaltyPoints: input.loyaltyPoints,
        statusPoints: input.statusPoints,
        loyaltyBalance: out.loyaltyBalance,
        source: input.source,
      })
    }
    return out
  },

  /**
   * Atomically spend LOYALTY points (VIP shop / manual). Idempotent per
   * `reference`. Throws on insufficient balance.
   */
  async spend(input: {
    userId: string
    points: number
    source: LoyaltyPointSource
    reference: string
    metadata?: Prisma.InputJsonValue
  }): Promise<{ applied: boolean; loyaltyBalance: number }> {
    if (input.points <= 0) throw AppError.badRequest('Spend amount must be positive', 'INVALID_SPEND')

    const result = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const dup = await tx.loyaltyPointTransaction.findUnique({ where: { reference: input.reference } })
          if (dup) {
            const p = await ensureProgress(tx, input.userId)
            return { applied: false, balance: p.loyaltyPoints }
          }

          const progress = await ensureProgress(tx, input.userId)
          const spend = BigInt(input.points)
          if (progress.loyaltyPoints < spend) {
            throw AppError.unprocessable('Insufficient loyalty points', 'INSUFFICIENT_POINTS')
          }
          const newBalance = progress.loyaltyPoints - spend

          const upd = await tx.vipProgress.updateMany({
            where: { id: progress.id, version: progress.version },
            data: { loyaltyPoints: newBalance, version: { increment: 1 } },
          })
          if (upd.count === 0) throw AppError.conflict('Concurrent point update — retry', 'WALLET_CONFLICT')

          await tx.loyaltyPointTransaction.create({
            data: {
              userId: input.userId,
              type: LoyaltyPointType.LOYALTY,
              source: input.source,
              amount: -spend,
              balanceAfter: newBalance,
              reference: input.reference,
              metadata: input.metadata,
            },
          })
          return { applied: true, balance: newBalance }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    return { applied: result.applied, loyaltyBalance: Number(result.balance) }
  },

  /** Paginated point ledger for a user. */
  async history(userId: string, opts: { type?: LoyaltyPointType; page: number; pageSize: number }) {
    const where = { userId, ...(opts.type ? { type: opts.type } : {}) }
    const [total, rows] = await prisma.$transaction([
      prisma.loyaltyPointTransaction.count({ where }),
      prisma.loyaltyPointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ])
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        source: r.source,
        amount: Number(r.amount),
        balanceAfter: Number(r.balanceAfter),
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    }
  },

  /** Admin manual adjustment (can be negative). Always audited via the ledger. */
  async adjust(userId: string, loyaltyDelta: number, statusDelta: number, actorId: string, note?: string) {
    if (loyaltyDelta === 0 && statusDelta === 0) return
    const reference = `adjust:${userId}:${actorId}:${note ?? ''}:${Date.now()}`
    if (loyaltyDelta >= 0 && statusDelta >= 0) {
      await this.earn({
        userId,
        loyaltyPoints: loyaltyDelta,
        statusPoints: statusDelta,
        source: LoyaltyPointSource.MANUAL_ADJUST,
        reference,
        metadata: { actorId, note },
      })
    } else if (loyaltyDelta < 0) {
      await this.spend({
        userId,
        points: -loyaltyDelta,
        source: LoyaltyPointSource.MANUAL_ADJUST,
        reference,
        metadata: { actorId, note },
      })
    }
    logger.info({ userId, loyaltyDelta, statusDelta, actorId }, 'loyalty manual adjustment')
  },
}
