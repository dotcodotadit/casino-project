import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'

/**
 * Free-spin package management. A FreeSpinAward tracks N spins at a fixed value
 * on a specific provider game. Winnings accrue on the award and, when attached
 * to a UserBonus, feed that bonus's wagering on conversion. Spin consumption is
 * atomic so concurrent spins can't over-draw the package.
 */
export const freespinService = {
  /** Issue a free-spin package to a user (optionally linked to a UserBonus). */
  async award(input: {
    userId: string
    totalSpins: number
    spinValueMinor: number
    gameId?: string
    userBonusId?: string
    expiryHours?: number
  }) {
    if (input.totalSpins <= 0) throw AppError.badRequest('Free spin count must be positive', 'INVALID_FREESPINS')
    const expiresAt = input.expiryHours
      ? new Date(Date.now() + input.expiryHours * 3_600_000)
      : null

    const award = await prisma.freeSpinAward.create({
      data: {
        userId: input.userId,
        userBonusId: input.userBonusId,
        gameId: input.gameId,
        totalSpins: input.totalSpins,
        spinValueMinor: BigInt(input.spinValueMinor),
        expiresAt,
      },
    })
    logger.info({ awardId: award.id, userId: input.userId, spins: input.totalSpins }, 'free spins awarded')
    return award
  },

  /** List a user's free-spin awards (optionally only active ones). */
  async list(userId: string, activeOnly = false) {
    const awards = await prisma.freeSpinAward.findMany({
      where: { userId, ...(activeOnly ? { status: 'ACTIVE' } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return awards.map((a) => ({
      id: a.id,
      gameId: a.gameId,
      totalSpins: a.totalSpins,
      usedSpins: a.usedSpins,
      remainingSpins: a.totalSpins - a.usedSpins,
      spinValue: Number(a.spinValueMinor),
      winnings: Number(a.winningsMinor),
      status: a.status,
      expiresAt: a.expiresAt?.toISOString() ?? null,
    }))
  },

  /**
   * Consume one (or more) spins from an award atomically. Records winnings.
   * Marks the award USED when exhausted. Returns the updated remaining count.
   */
  async consume(input: { awardId: string; userId: string; spins?: number; winningsMinor?: number }) {
    const spins = input.spins ?? 1
    return withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const award = await tx.freeSpinAward.findFirst({
            where: { id: input.awardId, userId: input.userId },
          })
          if (!award) throw AppError.notFound('Free spin award not found', 'FREESPIN_NOT_FOUND')
          if (award.status !== 'ACTIVE') throw AppError.unprocessable('Free spins not active', 'FREESPIN_INACTIVE')
          if (award.expiresAt && award.expiresAt < new Date()) {
            await tx.freeSpinAward.update({ where: { id: award.id }, data: { status: 'EXPIRED' } })
            throw AppError.unprocessable('Free spins expired', 'FREESPIN_EXPIRED')
          }
          const remaining = award.totalSpins - award.usedSpins
          if (spins > remaining) throw AppError.unprocessable('Not enough free spins', 'FREESPIN_EXHAUSTED')

          const used = award.usedSpins + spins
          const winnings = award.winningsMinor + BigInt(input.winningsMinor ?? 0)
          const exhausted = used >= award.totalSpins

          const updated = await tx.freeSpinAward.update({
            where: { id: award.id },
            data: {
              usedSpins: used,
              winningsMinor: winnings,
              status: exhausted ? 'USED' : 'ACTIVE',
            },
          })
          return {
            awardId: updated.id,
            remainingSpins: updated.totalSpins - updated.usedSpins,
            winnings: Number(updated.winningsMinor),
            status: updated.status,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )
  },

  /** Expire all past-due active awards. Returns the count expired. */
  async expireDue(now = new Date()): Promise<number> {
    const res = await prisma.freeSpinAward.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    })
    return res.count
  },
}
