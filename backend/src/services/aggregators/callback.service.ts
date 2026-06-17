import { Prisma, TransactionType, ProviderTxType, ProviderTxStatus, type Provider } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { withRetry } from '../../lib/retry.js'
import { getIO, userRoom } from '../../services/socket.service.js'
import { sessionService } from './session.service.js'
import { ProviderError, type NormalizedCallback, type CallbackResult } from './types.js'

/**
 * Seamless-wallet callback engine — the money-critical core.
 *
 * Guarantees:
 *  - **Idempotent**: every effect is keyed by `${code}:${action}:${providerTxId}`.
 *    A replayed callback returns the SAME balance and never double-charges
 *    (enforced both by an existence check and a UNIQUE constraint, with retry).
 *  - **ACID**: balance change + internal Transaction + ProviderTransaction happen
 *    in one SERIALIZABLE transaction with optimistic version locking.
 *  - **Real-time**: emits `balance:update` to the player's socket room after commit.
 */

const ACTION_TO_PTX: Record<string, ProviderTxType> = {
  bet: ProviderTxType.BET,
  win: ProviderTxType.WIN,
  refund: ProviderTxType.REFUND,
  rollback: ProviderTxType.ROLLBACK,
}
const ACTION_TO_TX: Record<string, TransactionType> = {
  bet: TransactionType.BET,
  win: TransactionType.PAYOUT,
  refund: TransactionType.ADJUSTMENT,
  rollback: TransactionType.ADJUSTMENT,
}

function emitBalance(userId: string, balanceMinor: number, txId: string) {
  try {
    getIO().to(userRoom(userId)).emit('balance:update', {
      walletType: 'MAIN',
      currency: 'USD',
      balance: balanceMinor,
      delta: 0,
      txId,
    })
  } catch {
    /* socket not initialized / user offline — non-fatal */
  }
}

export const callbackService = {
  /**
   * Process a normalized provider callback. `provider` is the DB row (already
   * loaded + signature-verified by the controller).
   */
  async process(provider: Provider, cb: NormalizedCallback): Promise<CallbackResult> {
    const session = await sessionService.getActiveByToken(cb.token)
    if (!session || session.providerId !== provider.id) {
      throw new ProviderError('SESSION_INVALID', 'Invalid or expired session token', 401)
    }
    if (session.user.status !== 'ACTIVE') {
      throw new ProviderError('ACCOUNT_INACTIVE', 'Account not active', 403)
    }
    const userId = session.userId

    // Read-only balance probe.
    if (cb.action === 'balance') {
      const wallet = await prisma.wallet.findUnique({
        where: { userId_type_currency: { userId, type: 'MAIN', currency: 'USD' } },
      })
      return { ok: true, balanceMinor: Number(wallet?.balance ?? 0), currency: 'USD' }
    }

    const idempotencyKey = `${provider.code}:${cb.action}:${cb.providerTxId}`
    const signedDelta = cb.action === 'bet' ? -cb.amountMinor : cb.amountMinor

    const result = await withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // Idempotent replay: same callback already applied → return cached balance.
          const existing = await tx.providerTransaction.findUnique({ where: { idempotencyKey } })
          if (existing) {
            return { balanceMinor: Number(existing.balanceAfter ?? 0), txId: existing.id, replay: true }
          }

          const wallet = await tx.wallet.findUnique({
            where: { userId_type_currency: { userId, type: 'MAIN', currency: 'USD' } },
          })
          if (!wallet) throw new ProviderError('WALLET_NOT_FOUND', 'Wallet not found', 500)

          const before = wallet.balance
          const after = before + BigInt(signedDelta)
          if (after < 0n) throw new ProviderError('INSUFFICIENT_FUNDS', 'Insufficient balance', 402)

          // Optimistic-locked balance write.
          const upd = await tx.wallet.updateMany({
            where: { id: wallet.id, version: wallet.version },
            data: { balance: after, version: { increment: 1 } },
          })
          if (upd.count === 0) {
            // Lost the race — surface as retryable conflict.
            throw new ProviderError('WALLET_CONFLICT', 'Concurrent balance update', 409, true)
          }

          // Internal ledger row (reference == idempotencyKey → DB-level dedup too).
          const internalTx = await tx.transaction.create({
            data: {
              userId,
              walletId: wallet.id,
              type: ACTION_TO_TX[cb.action],
              status: 'COMPLETED',
              amount: BigInt(Math.abs(signedDelta)),
              balanceBefore: before,
              balanceAfter: after,
              reference: idempotencyKey,
              metadata: { provider: provider.code, action: cb.action, roundId: cb.roundId, providerTxId: cb.providerTxId },
            },
          })

          // Provider-transaction mapping (audit + idempotency anchor).
          const ptx = await tx.providerTransaction.create({
            data: {
              userId,
              providerId: provider.id,
              sessionId: session.id,
              type: ACTION_TO_PTX[cb.action],
              status: ProviderTxStatus.COMPLETED,
              roundId: cb.roundId,
              providerTxId: cb.providerTxId,
              idempotencyKey,
              amountMinor: BigInt(cb.amountMinor),
              currency: cb.currency,
              balanceAfter: after,
              internalTxId: internalTx.id,
              raw: cb.raw as Prisma.InputJsonValue,
            },
          })

          return { balanceMinor: Number(after), txId: ptx.id, replay: false }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    )

    if (!result.replay) {
      emitBalance(userId, result.balanceMinor, result.txId)
      logger.info(
        { provider: provider.code, action: cb.action, userId, amount: cb.amountMinor, balance: result.balanceMinor },
        'aggregator callback applied',
      )
    }

    return { ok: true, balanceMinor: result.balanceMinor, currency: 'USD', transactionId: result.txId }
  },
}
