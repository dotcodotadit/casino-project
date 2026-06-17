import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { X, ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { DepositForm } from './DepositForm'
import { TransactionHistory } from './TransactionHistory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, cn } from '@/lib/utils'

interface WalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const tabTrigger =
  'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-gold/10 data-[state=active]:text-gold'

/** Wallet hub: balances + deposit / withdraw / history tabs. */
export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { wallets, totalUsdMinor, fetchWallet, withdraw } = useWalletStore()

  useEffect(() => {
    if (open) void fetchWallet()
  }, [open, fetchWallet])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-xl font-bold">Wallet</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Balances */}
          <div className="mb-5 rounded-lg border border-gold/30 bg-background/40 p-4">
            <p className="text-xs text-muted-foreground">Total (USD wallets)</p>
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

          <Tabs.Root defaultValue="deposit">
            <Tabs.List className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-background/40 p-1">
              <Tabs.Trigger value="deposit" className={tabTrigger}>
                <ArrowDownToLine className="h-4 w-4" /> Deposit
              </Tabs.Trigger>
              <Tabs.Trigger value="withdraw" className={tabTrigger}>
                <ArrowUpFromLine className="h-4 w-4" /> Withdraw
              </Tabs.Trigger>
              <Tabs.Trigger value="history" className={tabTrigger}>
                <History className="h-4 w-4" /> History
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="deposit">
              <DepositForm />
            </Tabs.Content>

            <Tabs.Content value="withdraw">
              <WithdrawForm onWithdraw={withdraw} />
            </Tabs.Content>

            <Tabs.Content value="history">
              <TransactionHistory />
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Inline withdraw form (FULL KYC enforced server-side). */
function WithdrawForm({
  onWithdraw,
}: {
  onWithdraw: (amountMinor: number, destination?: string) => Promise<void>
}) {
  const [amount, setAmount] = useState('20')
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const minor = Math.round(parseFloat(amount || '0') * 100)
    if (!Number.isFinite(minor) || minor <= 0) return setError('Enter a positive amount')
    if (destination.trim().length < 4) return setError('Enter a destination address/reference')
    setBusy(true)
    try {
      await onWithdraw(minor, destination.trim())
      setSuccess('Withdrawal requested (pending approval).')
    } catch (err: any) {
      const code = err?.response?.data?.error?.code
      setError(
        code === 'KYC_REQUIRED'
          ? 'Full KYC verification is required to withdraw.'
          : err?.response?.data?.error?.message ?? 'Withdrawal failed',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Amount (USD)</label>
        <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Destination (address / bank ref)</label>
        <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x… or IBAN" />
      </div>
      <p className={cn('text-xs text-muted-foreground')}>A withdrawal fee applies and FULL KYC is required.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Processing…' : 'Request withdrawal'}
      </Button>
    </form>
  )
}
