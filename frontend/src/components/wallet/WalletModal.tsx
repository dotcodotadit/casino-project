import { useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { X, History } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { TransactionHistory } from './TransactionHistory'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface WalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const tabTrigger =
  'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-gold/10 data-[state=active]:text-gold'

/** Demo wallet: virtual balance and history only; no deposits or withdrawals. */
export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { wallets, totalUsdMinor, fetchWallet } = useWalletStore()

  useEffect(() => {
    if (open) void fetchWallet()
  }, [open, fetchWallet])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-xl font-bold">Demo Wallet</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mb-5 rounded-lg border border-gold/30 bg-background/40 p-4">
            <p className="text-xs text-muted-foreground">Virtual credits · no cash value</p>
            <p className="font-mono text-2xl font-bold text-gold">{formatCurrency(totalUsdMinor)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {wallets.map((w) => (
                <div key={w.id} className="rounded-md bg-card px-2 py-1.5 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">{w.type}</p>
                  <p className="font-mono text-sm">{formatCurrency(w.balance, w.currency)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-md border border-border bg-background/40 p-3 text-sm text-muted-foreground">
            This is a play-money demo. Deposits and withdrawals are disabled. Virtual credits cannot be bought, sold, or redeemed.
          </div>

          <Tabs.Root defaultValue="history">
            <Tabs.List className="mb-4 grid grid-cols-1 gap-1 rounded-lg bg-background/40 p-1">
              <Tabs.Trigger value="history" className={tabTrigger}>
                <History className="h-4 w-4" /> Game history
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="history">
              <TransactionHistory />
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
