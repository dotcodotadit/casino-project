import { Prisma, RedemptionStatus, LoyaltyPointSource, WalletType, Currency, TransactionType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'
import { freespinService } from '../bonus/freespin.service.js'

/**
 * VIP shop — redeem LOYALTY points for rewards.
 *
 * Redemption is two-phase and idempotent:
 *  1. Atomically: validate level + stock, decrement stock, spend points, write a
 *     RedemptionHistory row (PENDING). Stock + points move in ONE transaction so
 *     a player can never overdraw points or oversell limited stock.
 *  2. Fulfilment: grant the reward (free spins / bonus money) and mark FULFILLED.
 *     Physical items stay PENDING for manual fulfilment by an admin.
 *
 * The points-spend uses the redemption reference as its idempotency key.
 */
export const vipShopService = {
  /** List shop items visible to a user (enabled + level-eligible). */
  async listFor(userId: string) {
    const p = await prisma.vipProgress.findUnique({ where: { userId }, include: { level: true } })
    const levelNo = p?.level.level ?? 0
    const items = await prisma.vipShopItem.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { costPoints: 'asc' }],
    })
    return items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      description: i.description,
      imageUrl: i.imageUrl,
      type: i.type,
      costPoints: Number(i.costPoints),
      value: i.valueMinor != null ? Number(i.valueMinor) : null,
      stock: i.stock,
      minLevel: i.minLevel,
      locked: levelNo < i.minLevel,
      soldOut: i.stock != null && i.stock <= 0,
    }))
  },

  /** Redeem an item. Atomic spend + stock; then fulfil. */
  async redeem(userId: string, itemId: string) {
    const reference = `redeem:${userId}:${itemId}:${Date.now()}`

    const { redemption, item } = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const item = await tx.vipShopItem.findUnique({ where: { id: itemId } })
          if (!item || !item.enabled) throw AppError.notFound('Item not available', 'SHOP_ITEM_NOT_FOUND')

          // Level gate.
          const progress = await tx.vipProgress.findUnique({ where: { userId }, include: { level: true } })
          const levelNo = progress?.level.level ?? 0
          if (levelNo < item.minLevel) throw AppError.forbidden('VIP level too low', 'SHOP_LEVEL_LOCKED')

          // Stock gate + atomic decrement (only when limited).
          if (item.stock != null) {
            const dec = await tx.vipShopItem.updateMany({
              where: { id: item.id, stock: { gt: 0 } },
              data: { stock: { decrement: 1 } },
            })
            if (dec.count === 0) throw AppError.conflict('Item sold out', 'SHOP_SOLD_OUT')
          }

          // Spend points (idempotent on `reference`) — inside the same tx via a
          // direct ledger write mirroring point-engine.spend.
          if (!progress) throw AppError.unprocessable('No VIP progress', 'VIP_NOT_FOUND')
          const cost = item.costPoints
          if (progress.loyaltyPoints < cost) throw AppError.unprocessable('Insufficient loyalty points', 'INSUFFICIENT_POINTS')
          const newBalance = progress.loyaltyPoints - cost
          const upd = await tx.vipProgress.updateMany({
            where: { id: progress.id, version: progress.version },
            data: { loyaltyPoints: newBalance, version: { increment: 1 } },
          })
          if (upd.count === 0) throw AppError.conflict('Concurrent point update — retry', 'WALLET_CONFLICT')
          await tx.loyaltyPointTransaction.create({
            data: {
              userId,
              type: 'LOYALTY',
              source: LoyaltyPointSource.REDEMPTION,
              amount: -cost,
              balanceAfter: newBalance,
              reference,
              metadata: { itemId, sku: item.sku },
            },
          })

          const redemption = await tx.redemptionHistory.create({
            data: {
              userId,
              itemId: item.id,
              costPoints: cost,
              status: RedemptionStatus.PENDING,
              reference,
              metadata: { sku: item.sku, type: item.type },
            },
          })
          return { redemption, item }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    // ── Fulfilment (post-commit) ──
    try {
      const grantedRef = await this.fulfil(userId, item, redemption.id)
      await prisma.redemptionHistory.update({
        where: { id: redemption.id },
        data: { status: item.type === 'PHYSICAL' ? RedemptionStatus.PENDING : RedemptionStatus.FULFILLED, grantedRef },
      })
    } catch (err) {
      logger.error({ err, redemptionId: redemption.id }, 'redemption fulfilment failed — leaving PENDING for review')
    }

    return {
      redemptionId: redemption.id,
      item: item.name,
      costPoints: Number(item.costPoints),
    }
  },

  /** Grant the reward for a redeemed item. Returns a reference to what was granted. */
  async fulfil(userId: string, item: { id: string; type: string; payload: Prisma.JsonValue; valueMinor: bigint | null }, redemptionId: string): Promise<string | null> {
    const payload = (item.payload as Record<string, unknown> | null) ?? {}
    switch (item.type) {
      case 'FREE_SPINS': {
        const award = await freespinService.award({
          userId,
          totalSpins: Number(payload.spins ?? 10),
          spinValueMinor: Number(payload.spinValueMinor ?? 20),
          gameId: typeof payload.gameId === 'string' ? payload.gameId : undefined,
          expiryHours: Number(payload.expiryHours ?? 168),
        })
        return award.id
      }
      case 'BONUS_MONEY': {
        // Credit BONUS wallet directly (instantly withdrawable shop reward).
        const amount = item.valueMinor ?? BigInt(Number(payload.amountMinor ?? 0))
        if (amount > 0n) await this.creditBonusMoney(userId, amount, redemptionId)
        return `bonusmoney:${redemptionId}`
      }
      case 'CASHBACK_BOOST':
      case 'CUSTOM':
        return `noted:${redemptionId}`
      case 'PHYSICAL':
      default:
        return null // manual fulfilment
    }
  },

  /** Credit a fixed BONUS-wallet amount (atomic, optimistic-locked). */
  async creditBonusMoney(userId: string, amountMinor: bigint, redemptionId: string) {
    return withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          let wallet = await tx.wallet.findUnique({
            where: { userId_type_currency: { userId, type: WalletType.BONUS, currency: Currency.USD } },
          })
          wallet ??= await tx.wallet.create({
            data: { userId, type: WalletType.BONUS, currency: Currency.USD, balance: 0n, version: 0 },
          })
          const after = wallet.balance + amountMinor
          const upd = await tx.wallet.updateMany({
            where: { id: wallet.id, version: wallet.version },
            data: { balance: after, version: { increment: 1 } },
          })
          if (upd.count === 0) throw AppError.conflict('Concurrent balance update — retry', 'WALLET_CONFLICT')
          await tx.transaction.create({
            data: {
              userId,
              walletId: wallet.id,
              type: TransactionType.BONUS,
              status: 'COMPLETED',
              amount: amountMinor,
              balanceBefore: wallet.balance,
              balanceAfter: after,
              reference: `redeem-bonusmoney:${redemptionId}`,
              metadata: { redemptionId },
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )
  },

  /** A user's redemption history. */
  async historyFor(userId: string) {
    const rows = await prisma.redemptionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { item: { select: { name: true, type: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      item: r.item.name,
      type: r.item.type,
      costPoints: Number(r.costPoints),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  },
}
