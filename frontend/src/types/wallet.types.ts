export type WalletType = 'MAIN' | 'BONUS' | 'CRYPTO'
export type Currency = 'USD' | 'BTC' | 'ETH' | 'USDT'

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'BET'
  | 'PAYOUT'
  | 'BONUS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'
  | 'ADJUSTMENT'

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type DepositMethod = 'CRYPTO_BTC' | 'CRYPTO_ETH' | 'CRYPTO_USDT' | 'BANK_TRANSFER'

export interface Wallet {
  id: string
  type: WalletType
  currency: Currency
  /** Balance in MINOR units (cents / smallest crypto unit). */
  balance: number
}

export interface Balances {
  wallets: Wallet[]
  totalUsdMinor: number
}

export interface Transaction {
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
  items: Transaction[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface DepositResult {
  wallet: Wallet
  txId: string
  reference: string
}

export interface WithdrawResult {
  wallet: Wallet
  txId: string
  fee: number
  reference: string
}

/** Real-time payload emitted by the backend `balance:update` socket event. */
export interface BalanceUpdate {
  walletType: WalletType
  currency: Currency
  balance: number
  delta: number
  txId: string
}

export interface TransactionFilter {
  type?: TransactionType
  status?: TransactionStatus
  page?: number
  pageSize?: number
}
