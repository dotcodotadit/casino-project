import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'

/**
 * Cashback computation. Cashback bonuses rebate a % of a player's net loss (or
 * deposits) over a rolling window. This service computes the eligible amount per
 * user; the engine then grants it as a UserBonus (subject to that bonus's own
 * wagering rules, which for cashback are usually 0 = instantly withdrawable).
 *
 * The actual grant is driven by the scheduler (period close) and uses the
 * engine's idempotent grantKey so a user can't be paid the same window twice.
 */
export const cashbackService = {
  /**
   * Net loss (bets − wins) in minor units over the window. Reads the immutable
   * Transaction ledger so the figure is always reconcilable.
   */
  async netLoss(userId: string, periodHours: number): Promise<number> {
    const since = new Date(Date.now() - periodHours * 3_600_000)
    const grouped = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        status: 'COMPLETED',
        type: { in: ['BET', 'PAYOUT'] },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    })
    let bets = 0n
    let wins = 0n
    for (const g of grouped) {
      if (g.type === 'BET') bets = g._sum.amount ?? 0n
      if (g.type === 'PAYOUT') wins = g._sum.amount ?? 0n
    }
    const net = bets - wins
    return net > 0n ? Number(net) : 0
  },

  /** Total completed deposits over the window (minor units). */
  async depositTotal(userId: string, periodHours: number): Promise<number> {
    const since = new Date(Date.now() - periodHours * 3_600_000)
    const agg = await prisma.transaction.aggregate({
      where: { userId, status: 'COMPLETED', type: 'DEPOSIT', createdAt: { gte: since } },
      _sum: { amount: true },
    })
    return Number(agg._sum.amount ?? 0n)
  },

  /**
   * Compute the cashback amount for a user against a CASHBACK bonus template.
   * Returns 0 when below threshold or no loss.
   */
  async computeAmount(
    userId: string,
    bonus: { cashbackBasis: string | null; cashbackPeriodHours: number | null; percentage: number | null; maxAmountMinor: bigint | null; minDepositMinor: bigint | null },
  ): Promise<number> {
    const period = bonus.cashbackPeriodHours ?? 24
    const pct = bonus.percentage ?? 0
    if (pct <= 0) return 0

    const basis = bonus.cashbackBasis === 'DEPOSIT'
      ? await this.depositTotal(userId, period)
      : await this.netLoss(userId, period)

    if (bonus.minDepositMinor != null && basis < Number(bonus.minDepositMinor)) return 0

    let amount = Math.floor(basis * pct)
    if (bonus.maxAmountMinor != null) amount = Math.min(amount, Number(bonus.maxAmountMinor))
    return amount
  },

  /**
   * Identify all users with a positive cashback for a bonus, for the scheduler.
   * Only considers users who have wagered (have BET transactions) in the window.
   */
  async eligibleUsers(bonus: {
    id: string
    cashbackBasis: string | null
    cashbackPeriodHours: number | null
    percentage: number | null
    maxAmountMinor: bigint | null
    minDepositMinor: bigint | null
  }): Promise<Array<{ userId: string; amountMinor: number }>> {
    const period = bonus.cashbackPeriodHours ?? 24
    const since = new Date(Date.now() - period * 3_600_000)
    const actors = await prisma.transaction.findMany({
      where: { status: 'COMPLETED', type: 'BET', createdAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    })
    const out: Array<{ userId: string; amountMinor: number }> = []
    for (const { userId } of actors) {
      const amount = await this.computeAmount(userId, bonus)
      if (amount > 0) out.push({ userId, amountMinor: amount })
    }
    logger.info({ bonusId: bonus.id, eligible: out.length }, 'cashback eligibility computed')
    return out
  },
}
