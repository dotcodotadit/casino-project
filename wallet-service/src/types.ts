import { z } from 'zod'
import type { WalletType, Currency, TransactionType, TransactionStatus, DepositMethod } from '@prisma/client'

// ── Validation ──────────────────────────────────────────────

export const depositSchema = z.object({
  amount: z.number().int().positive(), // minor units
  method: z.enum(['CRYPTO_BTC', 'CRYPTO_ETH', 'CRYPTO_USDT', 'BANK_TRANSFER']),
  walletType: z.enum(['MAIN', 'CRYPTO']).default('MAIN'),
})

export const withdrawSchema = z.object({
  amount: z.number().int().positive(),
  walletType: z.enum(['MAIN', 'CRYPTO']).default('MAIN'),
  // simulated destination (crypto address / bank ref)
  destination: z.string().min(4).max(128),
})

export const transferSchema = z.object({
  amount: z.number().int().positive(),
  fromType: z.enum(['MAIN', 'BONUS', 'CRYPTO']),
  toType: z.enum(['MAIN', 'BONUS', 'CRYPTO']),
})

export const historyQuerySchema = z.object({
  type: z
    .enum(['DEPOSIT', 'WITHDRAW', 'BET', 'PAYOUT', 'BONUS', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'ADJUSTMENT'])
    .optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type DepositInput = z.infer<typeof depositSchema>
export type WithdrawInput = z.infer<typeof withdrawSchema>
export type TransferInput = z.infer<typeof transferSchema>
export type HistoryQuery = z.infer<typeof historyQuerySchema>

// ── DTOs ────────────────────────────────────────────────────

export interface WalletDTO {
  id: string
  type: WalletType
  currency: Currency
  balance: number // minor units (Number is safe up to 2^53; demo amounts are small)
}

export interface BalancesDTO {
  wallets: WalletDTO[]
  totalUsdMinor: number
}

export interface TransactionDTO {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  feeAmount: number
  balanceAfter: number
  method: DepositMethod | null
  reference: string | null
  createdAt: string
}

export interface PaginatedTransactions {
  items: TransactionDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// Internal result from a balance mutation — broadcast over Socket.io.
export interface BalanceChange {
  userId: string
  walletType: WalletType
  currency: Currency
  balance: number
  delta: number
  txId: string
}
