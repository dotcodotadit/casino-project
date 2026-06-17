import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { walletService } from '@/services/wallet.service'
import { notify } from '@/store/useNotifications'
import { formatCurrency } from '@/lib/utils'
import type {
  Wallet,
  Transaction,
  BalanceUpdate,
  DepositMethod,
  WalletType,
} from '@/types/wallet.types'

interface WalletState {
  // Multi-wallet view.
  wallets: Wallet[]
  totalUsdMinor: number
  // Backward-compatible "primary" wallet (MAIN/USD) used by game pages + header.
  wallet: Wallet | null
  transactions: Transaction[]
  loading: boolean

  fetchWallet: () => Promise<void>
  fetchTransactions: () => Promise<void>
  /** Simplified deposit (amount in minor units); defaults to bank transfer → MAIN. */
  deposit: (amountMinor: number, method?: DepositMethod) => Promise<void>
  /** Simplified withdraw (amount in minor units); destination optional in demo. */
  withdraw: (amountMinor: number, destination?: string) => Promise<void>
  transfer: (amountMinor: number, fromType: WalletType, toType: WalletType) => Promise<void>
  /** Apply a real-time balance update (from socket or a bet result). */
  applyBalance: (balance: number, walletType?: WalletType) => void
  /** Apply a full BalanceUpdate socket payload. */
  applyBalanceUpdate: (u: BalanceUpdate) => void
  /** Wipe all wallet state (called on logout to prevent cross-user leakage). */
  reset: () => void
}

const MAIN = (wallets: Wallet[]): Wallet | null =>
  wallets.find((w) => w.type === 'MAIN' && w.currency === 'USD') ?? wallets[0] ?? null

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      wallets: [],
      totalUsdMinor: 0,
      wallet: null,
      transactions: [],
      loading: false,

      fetchWallet: async () => {
        set({ loading: true })
        try {
          const { wallets, totalUsdMinor } = await walletService.getBalances()
          set({ wallets, totalUsdMinor, wallet: MAIN(wallets) })
        } finally {
          set({ loading: false })
        }
      },

      fetchTransactions: async () => {
        const { items } = await walletService.transactions({ pageSize: 50 })
        set({ transactions: items })
      },

      deposit: async (amountMinor, method = 'BANK_TRANSFER') => {
        await walletService.deposit({ amount: amountMinor, method })
        await get().fetchWallet()
        await get().fetchTransactions()
        notify({ title: 'Deposit successful', message: `${formatCurrency(amountMinor)} credited`, variant: 'success' })
      },

      withdraw: async (amountMinor, destination = 'demo-destination') => {
        await walletService.withdraw({ amount: amountMinor, destination })
        await get().fetchWallet()
        await get().fetchTransactions()
        notify({ title: 'Withdrawal requested', message: `${formatCurrency(amountMinor)} pending approval`, variant: 'info' })
      },

      transfer: async (amountMinor, fromType, toType) => {
        await walletService.transfer({ amount: amountMinor, fromType, toType })
        await get().fetchWallet()
      },

      applyBalance: (balance, walletType = 'MAIN') =>
        set((s) => {
          // Match on type AND currency (USD for the primary wallet) so we never
          // update multiple same-type wallets — consistent with applyBalanceUpdate.
          const currency = walletType === 'MAIN' || walletType === 'BONUS' ? 'USD' : 'USDT'
          const wallets = s.wallets.map((w) =>
            w.type === walletType && w.currency === currency ? { ...w, balance } : w,
          )
          return { wallets, wallet: MAIN(wallets) }
        }),

      applyBalanceUpdate: (u) =>
        set((s) => {
          const wallets = s.wallets.map((w) =>
            w.type === u.walletType && w.currency === u.currency ? { ...w, balance: u.balance } : w,
          )
          return { wallets, wallet: MAIN(wallets) }
        }),

      reset: () => set({ wallets: [], totalUsdMinor: 0, wallet: null, transactions: [], loading: false }),
    }),
    {
      name: 'casino-wallet',
      storage: createJSONStorage(() => localStorage),
      // Persist only the cached snapshot, not loading flags.
      partialize: (s) => ({ wallets: s.wallets, totalUsdMinor: s.totalUsdMinor, wallet: s.wallet }),
    },
  ),
)

// Re-export under the prompt's preferred name.
export const useWallet = useWalletStore
