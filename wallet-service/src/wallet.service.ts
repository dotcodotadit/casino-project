import {
  Prisma,
  WalletType,
  Currency,
  TransactionType,
  TransactionStatus,
  DepositMethod,
  KycLevel,
} from '@prisma/client'
import { randomUUID, randomBytes } from 'node:crypto'
import { prisma } from './lib/prisma.js'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { AppError } from './lib/errors.js'
import { publishBonusEvent } from './lib/publisher.js'
import type { WalletDTO, BalancesDTO, BalanceChange, DepositInput, WithdrawInput, TransferInput } from './types.js'

// Optional hook so the HTTP layer can push real-time balance updates.
type BalanceListener = (change: BalanceChange) => void
let balanceListener: BalanceListener | null = null
export function onBalanceChange(fn: BalanceListener) {
  balanceListener = fn
}

function toWalletDTO(w: { id: string; type: WalletType; currency: Currency; balance: bigint }): WalletDTO {
  return { id: w.id, type: w.type, currency: w.currency, balance: Number(w.balance) }
}

const DEPOSIT_METHOD_CURRENCY: Record<DepositMethod, Currency> = {
  CRYPTO_BTC: Currency.BTC,
  CRYPTO_ETH: Currency.ETH,
  CRYPTO_USDT: Currency.USDT,
  BANK_TRANSFER: Currency.USD,
}

/**
 * The wallet ledger. Every balance mutation:
 *   1. runs inside a serializable-ish DB transaction,
 *   2. uses optimistic locking via the wallet `version` column,
 *   3. writes an immutable Transaction row (audit trail),
 *   4. emits a BalanceChange for real-time updates.
 */
export const walletService = {
  async getWallets(userId: string): Promise<BalancesDTO> {
    const wallets = await prisma.wallet.findMany({ where: { userId }, orderBy: { type: 'asc' } })
    const dtos = wallets.map(toWalletDTO)
    // Naive USD total — in a real system we'd convert via FX rates.
    const totalUsdMinor = dtos
      .filter((w) => w.currency === Currency.USD)
      .reduce((sum, w) => sum + w.balance, 0)
    return { wallets: dtos, totalUsdMinor }
  },

  async getWallet(userId: string, type: WalletType, currency: Currency) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId_type_currency: { userId, type, currency } },
    })
    if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND')
    return wallet
  },

  /**
   * Core atomic balance mutation with optimistic locking + ledger write.
   * `delta` is signed (positive credit, negative debit).
   */
  async applyDelta(params: {
    userId: string
    type: WalletType
    currency: Currency
    delta: bigint
    txType: TransactionType
    feeAmount?: bigint
    method?: DepositMethod
    reference?: string
    metadata?: Prisma.InputJsonValue
    gameRoundId?: string
    status?: TransactionStatus
  }): Promise<{ wallet: WalletDTO; txId: string }> {
    const {
      userId,
      type,
      currency,
      delta,
      txType,
      feeAmount = 0n,
      method,
      reference,
      metadata,
      gameRoundId,
      status = TransactionStatus.COMPLETED,
    } = params

    const result = await prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId_type_currency: { userId, type, currency } },
        })
        if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND')

        const balanceBefore = wallet.balance
        const balanceAfter = balanceBefore + delta

        if (balanceAfter < 0n) {
          throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')
        }

        // Optimistic lock: only update if version is unchanged.
        const updated = await tx.wallet.updateMany({
          where: { id: wallet.id, version: wallet.version },
          data: { balance: balanceAfter, version: { increment: 1 } },
        })
        if (updated.count === 0) {
          // Another concurrent mutation won the race.
          throw AppError.conflict('Concurrent balance update — retry', 'WALLET_CONFLICT')
        }

        const transaction = await tx.transaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: txType,
            status,
            amount: delta < 0n ? -delta : delta,
            feeAmount,
            balanceBefore,
            balanceAfter,
            method,
            reference: reference ?? randomUUID(),
            metadata,
            gameRoundId,
          },
        })

        return {
          wallet: toWalletDTO({ ...wallet, balance: balanceAfter }),
          txId: transaction.id,
          delta,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    balanceListener?.({
      userId,
      walletType: type,
      currency,
      balance: result.wallet.balance,
      delta: Number(result.delta),
      txId: result.txId,
    })

    return { wallet: result.wallet, txId: result.txId }
  },

  /** Simulated deposit. Instantly credits in demo; real flow would await confirmations. */
  async deposit(userId: string, input: DepositInput) {
    if (input.amount < config.minDepositMinor || input.amount > config.maxDepositMinor) {
      throw AppError.badRequest(
        `Deposit must be between ${config.minDepositMinor} and ${config.maxDepositMinor} minor units`,
        'DEPOSIT_LIMIT',
      )
    }
    const currency = DEPOSIT_METHOD_CURRENCY[input.method]
    const walletType = input.walletType === 'CRYPTO' ? WalletType.CRYPTO : WalletType.MAIN

    // Simulated external reference (fake tx hash / bank ref).
    const reference = `dep_${randomBytes(8).toString('hex')}`

    const { wallet, txId } = await this.applyDelta({
      userId,
      type: walletType,
      currency: walletType === WalletType.CRYPTO ? currency : Currency.USD,
      delta: BigInt(input.amount),
      txType: TransactionType.DEPOSIT,
      method: input.method,
      reference,
      metadata: { simulated: true, method: input.method },
    })

    logger.info({ userId, amount: input.amount, method: input.method }, 'deposit completed (simulation)')

    // Announce the deposit so the backend bonus engine can grant welcome/reload
    // bonuses. Fire-and-forget over Redis — never blocks or fails the deposit.
    publishBonusEvent('deposit.completed', {
      userId,
      amountMinor: input.amount,
      transactionId: txId,
    })

    return { wallet, txId, reference }
  },

  /**
   * Withdraw with fee calculation. Requires FULL KYC (checked in middleware).
   * Debits stake+fee, records two ledger rows (withdraw + fee).
   */
  async withdraw(userId: string, input: WithdrawInput) {
    if (input.amount < config.minWithdrawalMinor) {
      throw AppError.badRequest(`Minimum withdrawal is ${config.minWithdrawalMinor} minor units`, 'WITHDRAW_MIN')
    }
    if (input.amount > config.maxWithdrawalMinor) {
      throw AppError.badRequest(`Maximum withdrawal is ${config.maxWithdrawalMinor} minor units`, 'WITHDRAW_MAX')
    }

    const fee = Math.ceil((input.amount * config.withdrawalFeeBps) / 10_000)
    const totalDebit = input.amount + fee
    const walletType = input.walletType === 'CRYPTO' ? WalletType.CRYPTO : WalletType.MAIN
    const wallet = await this.getWallet(
      userId,
      walletType,
      walletType === WalletType.CRYPTO ? Currency.USDT : Currency.USD,
    )

    if (wallet.balance < BigInt(totalDebit)) {
      throw AppError.unprocessable('Insufficient balance for amount + fee', 'INSUFFICIENT_FUNDS')
    }

    const reference = `wd_${randomBytes(8).toString('hex')}`
    // Single combined debit (amount + fee), fee tracked on the row.
    const { wallet: updated, txId } = await this.applyDelta({
      userId,
      type: walletType,
      currency: wallet.currency,
      delta: -BigInt(totalDebit),
      txType: TransactionType.WITHDRAW,
      feeAmount: BigInt(fee),
      reference,
      status: TransactionStatus.PENDING, // real withdrawals await manual/auto approval
      metadata: { destination: input.destination, fee, simulated: true },
    })

    logger.info({ userId, amount: input.amount, fee }, 'withdrawal requested (simulation)')
    return { wallet: updated, txId, fee, reference }
  },

  /** Internal transfer between a user's own wallets (e.g. BONUS -> MAIN). */
  async transfer(userId: string, input: TransferInput) {
    if (input.fromType === input.toType) {
      throw AppError.badRequest('Cannot transfer to the same wallet', 'SAME_WALLET')
    }
    const from = await this.getWallet(
      userId,
      input.fromType as WalletType,
      input.fromType === 'CRYPTO' ? Currency.USDT : Currency.USD,
    )
    if (from.balance < BigInt(input.amount)) {
      throw AppError.unprocessable('Insufficient balance', 'INSUFFICIENT_FUNDS')
    }
    const linkRef = `tr_${randomBytes(8).toString('hex')}`

    const debit = await this.applyDelta({
      userId,
      type: input.fromType as WalletType,
      currency: from.currency,
      delta: -BigInt(input.amount),
      txType: TransactionType.TRANSFER_OUT,
      reference: `${linkRef}_out`,
      metadata: { linkRef, to: input.toType },
    })
    const credit = await this.applyDelta({
      userId,
      type: input.toType as WalletType,
      currency: input.toType === 'CRYPTO' ? Currency.USDT : Currency.USD,
      delta: BigInt(input.amount),
      txType: TransactionType.TRANSFER_IN,
      reference: `${linkRef}_in`,
      metadata: { linkRef, from: input.fromType },
    })

    return { from: debit.wallet, to: credit.wallet }
  },

  /**
   * Debit a bet stake from MAIN. Called by the game backend before resolving a round.
   * Returns the new balance; throws INSUFFICIENT_FUNDS if not enough.
   */
  async debitBet(userId: string, stakeMinor: number, gameRoundId: string, meta?: Prisma.InputJsonValue) {
    return this.applyDelta({
      userId,
      type: WalletType.MAIN,
      currency: Currency.USD,
      delta: -BigInt(stakeMinor),
      txType: TransactionType.BET,
      gameRoundId,
      metadata: meta,
    })
  },

  /** Credit a winning payout to MAIN. */
  async creditPayout(userId: string, payoutMinor: number, gameRoundId: string, meta?: Prisma.InputJsonValue) {
    if (payoutMinor <= 0) {
      // No payout to credit; return current balance snapshot.
      const w = await this.getWallet(userId, WalletType.MAIN, Currency.USD)
      return { wallet: toWalletDTO(w), txId: '' }
    }
    return this.applyDelta({
      userId,
      type: WalletType.MAIN,
      currency: Currency.USD,
      delta: BigInt(payoutMinor),
      txType: TransactionType.PAYOUT,
      gameRoundId,
      metadata: meta,
    })
  },

  /** KYC guard used by withdraw route. */
  async assertWithdrawalEligible(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { kycLevel: true, status: true } })
    if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND')
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Account not active', 'ACCOUNT_INACTIVE')
    if (user.kycLevel !== KycLevel.FULL) throw AppError.forbidden('Full KYC required to withdraw', 'KYC_REQUIRED')
  },
}
