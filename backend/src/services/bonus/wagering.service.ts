import { Prisma, TransactionType, TransactionStatus, WalletType, Currency } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { AppError } from '../../lib/errors.js'
import { bonusBus } from '../../events/bonus.events.js'
import { conditionsService } from './conditions.service.js'

type Tx = Prisma.TransactionClient

/**
 * Wagering ledger — the money-critical core of the bonus engine.
 *
 * Mirrors bet.service: every balance mutation is an optimistic-locked
 * updateMany + an immutable Transaction row, all inside a SERIALIZABLE
 * transaction wrapped in withRetry. The BONUS wallet holds locked bonus funds;
 * on completion they convert to the MAIN wallet.
 */

async function getOrCreateWallet(tx: Tx, userId: string, type: WalletType) {
  const existing = await tx.wallet.findUnique({
    where: { userId_type_currency: { userId, type, currency: Currency.USD } },
  })
  if (existing) return existing
  return tx.wallet.create({ data: { userId, type, currency: Currency.USD, balance: 0n, version: 0 } })
}

/** Optimistic-locked balance mutation + immutable Transaction row. */
async function mutate(
  tx: Tx,
  params: {
    userId: string
    walletId: string
    expectedVersion: number
    balanceBefore: bigint
    delta: bigint
    txType: TransactionType
    metadata?: Prisma.InputJsonValue
    reference?: string
  },
): Promise<bigint> {
  const after = params.balanceBefore + params.delta
  if (after < 0n) throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')

  const upd = await tx.wallet.updateMany({
    where: { id: params.walletId, version: params.expectedVersion },
    data: { balance: after, version: { increment: 1 } },
  })
  if (upd.count === 0) throw AppError.conflict('Concurrent balance update — retry', 'WALLET_CONFLICT')

  await tx.transaction.create({
    data: {
      userId: params.userId,
      walletId: params.walletId,
      type: params.txType,
      status: TransactionStatus.COMPLETED,
      amount: params.delta < 0n ? -params.delta : params.delta,
      balanceBefore: params.balanceBefore,
      balanceAfter: after,
      reference: params.reference,
      metadata: params.metadata,
    },
  })
  return after
}

export const wageringService = {
  /**
   * Credit bonus funds into the BONUS wallet for a freshly-activated UserBonus.
   * Atomic + audited. Called by the engine right after a UserBonus is created.
   */
  async creditBonusFunds(input: {
    userId: string
    userBonusId: string
    amountMinor: number
    reference: string
    metadata?: Prisma.InputJsonValue
  }): Promise<{ bonusBalanceAfter: number }> {
    if (input.amountMinor <= 0) return { bonusBalanceAfter: 0 }
    const delta = BigInt(input.amountMinor)

    return withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const wallet = await getOrCreateWallet(tx, input.userId, WalletType.BONUS)
          const balanceAfter = await mutate(tx, {
            userId: input.userId,
            walletId: wallet.id,
            expectedVersion: wallet.version,
            balanceBefore: wallet.balance,
            delta,
            txType: TransactionType.BONUS,
            reference: input.reference,
            metadata: input.metadata,
          })
          await tx.bonusAuditLog.create({
            data: {
              userBonusId: input.userBonusId,
              userId: input.userId,
              action: 'bonus.credit',
              amountMinor: delta,
              metadata: input.metadata,
            },
          })
          return { bonusBalanceAfter: Number(balanceAfter) }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )
  },

  /**
   * Apply a settled bet's turnover to a user's ACTIVE bonuses. Idempotent per
   * (userBonus, sourceRef). Weights the stake by game category, respects the
   * max-bet cap, and completes/releases the bonus when the requirement is met.
   *
   * Returns the affected UserBonus ids so callers can emit progress events.
   */
  async applyTurnover(input: {
    userId: string
    stakeMinor: number
    gameCategory?: string
    sourceType: 'GAME_ROUND' | 'PROVIDER_TX'
    sourceRef: string
  }): Promise<void> {
    const weights = await conditionsService.categoryWeights()
    const category = (input.gameCategory ?? 'SLOTS').toUpperCase()
    const weight = weights[category] ?? weights.OTHER ?? 1

    // Find candidate ACTIVE bonuses (oldest first → clear them in order).
    const active = await prisma.userBonus.findMany({
      where: { userId: input.userId, status: 'ACTIVE' },
      orderBy: { activatedAt: 'asc' },
      include: { wagerRequirement: true, bonus: true },
    })
    if (active.length === 0) return

    for (const ub of active) {
      // Enforce max-bet while wagering (anti-abuse). Over-cap bets simply do not
      // contribute — they are NOT rejected (the bet already settled).
      const maxBet = ub.bonus.maxBetMinor ?? ub.wagerRequirement?.maxBetMinor
      if (maxBet != null && BigInt(input.stakeMinor) > maxBet) {
        logger.debug({ userBonusId: ub.id }, 'bet exceeds max-bet — no contribution')
        continue
      }
      if (weight <= 0) continue

      try {
        await this.contribute(ub.id, {
          sourceType: input.sourceType,
          sourceRef: input.sourceRef,
          stakeMinor: input.stakeMinor,
          weight,
        })
      } catch (err) {
        logger.error({ err, userBonusId: ub.id }, 'turnover contribution failed')
      }
    }
  },

  /**
   * Idempotently record one contribution against a UserBonus and advance its
   * progress; release the bonus when the requirement is met. SERIALIZABLE +
   * retry; the (userBonusId, sourceRef) unique index guarantees exactly-once.
   */
  async contribute(
    userBonusId: string,
    c: { sourceType: string; sourceRef: string; stakeMinor: number; weight: number },
  ): Promise<void> {
    const result = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const ub = await tx.userBonus.findUnique({
            where: { id: userBonusId },
            include: { wagerRequirement: true },
          })
          if (!ub || ub.status !== 'ACTIVE') return null

          // Idempotency: skip if this source already contributed.
          const dup = await tx.wagerContribution.findUnique({
            where: { userBonusId_sourceRef: { userBonusId, sourceRef: c.sourceRef } },
          })
          if (dup) return null

          const required = ub.wagerRequiredMinor
          const remaining = required - ub.wagerProgressMinor
          if (remaining <= 0n) return null

          const raw = BigInt(Math.floor(c.stakeMinor * c.weight))
          const contributed = raw > remaining ? remaining : raw
          if (contributed <= 0n) return null

          await tx.wagerContribution.create({
            data: {
              userBonusId,
              sourceType: c.sourceType,
              sourceRef: c.sourceRef,
              stakeMinor: BigInt(c.stakeMinor),
              weight: c.weight,
              contributedMinor: contributed,
            },
          })

          const newProgress = ub.wagerProgressMinor + contributed
          const met = newProgress >= required

          await tx.userBonus.update({
            where: { id: userBonusId },
            data: { wagerProgressMinor: newProgress },
          })
          if (ub.wagerRequirement) {
            await tx.bonusWagerRequirement.update({
              where: { userBonusId },
              data: { progressMinor: newProgress },
            })
          }

          await tx.bonusAuditLog.create({
            data: {
              userBonusId,
              userId: ub.userId,
              action: 'bonus.progress',
              amountMinor: contributed,
              metadata: { sourceRef: c.sourceRef, progress: newProgress.toString(), required: required.toString() },
            },
          })

          return {
            userId: ub.userId,
            progress: Number(newProgress),
            required: Number(required),
            met,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (!result) return

    bonusBus.publish('bonus.progress', {
      userId: result.userId,
      userBonusId,
      progressMinor: result.progress,
      requiredMinor: result.required,
      percent: result.required > 0 ? Math.min(100, Math.round((result.progress / result.required) * 100)) : 100,
    })

    if (result.met) await this.release(userBonusId)
  },

  /**
   * Complete a UserBonus: move the convertible bonus balance from BONUS → MAIN
   * (respecting maxConvertible), mark COMPLETED, and emit completion.
   */
  async release(userBonusId: string): Promise<void> {
    const out = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const ub = await tx.userBonus.findUnique({ where: { id: userBonusId } })
          if (!ub || ub.status !== 'ACTIVE') return null

          const bonusWallet = await getOrCreateWallet(tx, ub.userId, WalletType.BONUS)
          // Convertible = min(current bonus balance, grant, maxConvertible).
          let convertible = bonusWallet.balance
          if (ub.maxConvertibleMinor != null && convertible > ub.maxConvertibleMinor) {
            convertible = ub.maxConvertibleMinor
          }
          if (convertible < 0n) convertible = 0n

          // Debit BONUS wallet by the converted amount.
          let bonusVersion = bonusWallet.version
          if (convertible > 0n) {
            await mutate(tx, {
              userId: ub.userId,
              walletId: bonusWallet.id,
              expectedVersion: bonusVersion,
              balanceBefore: bonusWallet.balance,
              delta: -convertible,
              txType: TransactionType.TRANSFER_OUT,
              reference: `bonus-release-out:${userBonusId}`,
              metadata: { userBonusId },
            })
            bonusVersion += 1

            // Credit MAIN wallet.
            const mainWallet = await getOrCreateWallet(tx, ub.userId, WalletType.MAIN)
            await mutate(tx, {
              userId: ub.userId,
              walletId: mainWallet.id,
              expectedVersion: mainWallet.version,
              balanceBefore: mainWallet.balance,
              delta: convertible,
              txType: TransactionType.TRANSFER_IN,
              reference: `bonus-release-in:${userBonusId}`,
              metadata: { userBonusId },
            })
          }

          await tx.userBonus.update({
            where: { id: userBonusId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              releasedAmountMinor: convertible,
            },
          })
          await tx.bonusAuditLog.create({
            data: {
              userBonusId,
              userId: ub.userId,
              action: 'bonus.complete',
              amountMinor: convertible,
            },
          })
          return { userId: ub.userId, released: Number(convertible) }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (out) {
      bonusBus.publish('bonus.completed', { userId: out.userId, userBonusId, releasedMinor: out.released })
      logger.info({ userBonusId, released: out.released }, 'bonus released to MAIN wallet')
    }
  },

  /**
   * Forfeit/cancel a UserBonus and remove its locked bonus funds. Used by player
   * cancel, expiry sweep, and admin/abuse cancellation.
   */
  async forfeit(userBonusId: string, status: 'FORFEITED' | 'EXPIRED' | 'CANCELLED', reason: string): Promise<void> {
    const out = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const ub = await tx.userBonus.findUnique({ where: { id: userBonusId } })
          if (!ub || ['COMPLETED', 'FORFEITED', 'EXPIRED', 'CANCELLED'].includes(ub.status)) return null

          // Reclaim remaining locked bonus funds (up to the granted amount).
          const bonusWallet = await getOrCreateWallet(tx, ub.userId, WalletType.BONUS)
          const reclaim = bonusWallet.balance > ub.grantedAmountMinor ? ub.grantedAmountMinor : bonusWallet.balance
          if (reclaim > 0n) {
            await mutate(tx, {
              userId: ub.userId,
              walletId: bonusWallet.id,
              expectedVersion: bonusWallet.version,
              balanceBefore: bonusWallet.balance,
              delta: -reclaim,
              txType: TransactionType.ADJUSTMENT,
              reference: `bonus-forfeit:${userBonusId}`,
              metadata: { userBonusId, reason },
            })
          }

          await tx.userBonus.update({ where: { id: userBonusId }, data: { status } })
          await tx.bonusAuditLog.create({
            data: {
              userBonusId,
              userId: ub.userId,
              action: status === 'EXPIRED' ? 'bonus.expire' : 'bonus.cancel',
              amountMinor: reclaim,
              metadata: { reason },
            },
          })
          return { userId: ub.userId }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (out) {
      if (status === 'EXPIRED') bonusBus.publish('bonus.expired', { userId: out.userId, userBonusId })
      else bonusBus.publish('bonus.cancelled', { userId: out.userId, userBonusId, reason })
    }
  },
}
