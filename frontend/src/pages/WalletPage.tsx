import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingScreen } from '@/components/feedback/Spinner'
import { EmptyState } from '@/components/feedback/states'
import { formatCurrency } from '@/lib/utils'

export default function WalletPage() {
  const { wallet, transactions, loading, fetchWallet, fetchTransactions, deposit, withdraw } =
    useWalletStore()
  const [amount, setAmount] = useState('50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchWallet()
    void fetchTransactions()
  }, [fetchWallet, fetchTransactions])

  // Initial load (no cached wallet yet).
  if (loading && !wallet) return <LoadingScreen label="Loading your wallet…" />

  const run = async (fn: (minor: number) => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      const minor = Math.round(parseFloat(amount || '0') * 100)
      if (minor <= 0) throw new Error('Enter a positive amount')
      await fn(minor)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err.message ?? 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-gold/30 bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">Current balance</p>
            <p className="mt-1 font-mono text-3xl font-black text-gold">
              {wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
            </p>
          </div>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button className="flex-1" disabled={busy} onClick={() => run(deposit)}>
              Deposit
            </Button>
            <Button variant="royal" className="flex-1" disabled={busy} onClick={() => run(withdraw)}>
              Withdraw
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Demo deposits are simulated instantly. Withdrawals require KYC verification.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {transactions.length === 0 && (
              <EmptyState icon={Receipt} title="No transactions yet" message="Make a deposit to get started." />
            )}
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      ['DEPOSIT', 'PAYOUT', 'BONUS'].includes(tx.type)
                        ? 'text-emerald-400'
                        : 'text-destructive'
                    }
                  >
                    {formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
