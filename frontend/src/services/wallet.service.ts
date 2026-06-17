import { api } from '@/lib/api'
import type {
  Balances,
  DepositResult,
  WithdrawResult,
  PaginatedTransactions,
  TransactionFilter,
  DepositMethod,
  WalletType,
} from '@/types/wallet.types'

interface Envelope<T> {
  success: boolean
  data: T
}

export const walletService = {
  async getBalances(): Promise<Balances> {
    const { data } = await api.get<Envelope<Balances>>('/wallet')
    return data.data
  },

  async deposit(input: {
    amount: number // minor units
    method: DepositMethod
    walletType?: 'MAIN' | 'CRYPTO'
  }): Promise<DepositResult> {
    const { data } = await api.post<Envelope<DepositResult>>('/wallet/deposit', input)
    return data.data
  },

  async withdraw(input: {
    amount: number
    walletType?: 'MAIN' | 'CRYPTO'
    destination: string
  }): Promise<WithdrawResult> {
    const { data } = await api.post<Envelope<WithdrawResult>>('/wallet/withdraw', input)
    return data.data
  },

  async transfer(input: {
    amount: number
    fromType: WalletType
    toType: WalletType
  }): Promise<{ from: unknown; to: unknown }> {
    const { data } = await api.post<Envelope<{ from: unknown; to: unknown }>>('/wallet/transfer', input)
    return data.data
  },

  async transactions(filter: TransactionFilter = {}): Promise<PaginatedTransactions> {
    const params = new URLSearchParams()
    if (filter.type) params.set('type', filter.type)
    if (filter.status) params.set('status', filter.status)
    params.set('page', String(filter.page ?? 1))
    params.set('pageSize', String(filter.pageSize ?? 20))
    const { data } = await api.get<Envelope<PaginatedTransactions>>(`/wallet/transactions?${params}`)
    return data.data
  },
}
