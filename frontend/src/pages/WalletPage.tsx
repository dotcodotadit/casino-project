import { useEffect } from 'react'
import { Receipt } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingScreen } from '@/components/feedback/Spinner'
import { EmptyState } from '@/components/feedback/states'
import { formatCurrency } from '@/lib/utils'

export default function WalletPage() {
  const { wallet, wallets, transactions, loading, fetchWallet, fetchTransactions } = useWalletStore()

  useEffect(() => {
    void fetchWallet()
    void fetchTransactions()
  }, [fetchWallet, fetchTransactions])

  if (loading && !wallet) return <LoadingScreen label="Loading your demo wallet…" />

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Demo wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-gold/30 bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">Virtual balance · no cash value</p>
            <p className="mt-1 font-mono text-3xl font-black text-gold">
              {wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {wallets.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-background/40 p-3 text-center">
                <p className="text-xs uppercase text-muted-foreground">{item.type}</p>
                <p className="font-mono font-semibold">{formatCurrency(item.balance, item.currency)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            This is a play-money demo. Deposits and withdrawals are disabled. Credits cannot be bought, sold, or redeemed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {transactions.length === 0 && (
              <EmptyState icon={Receipt} title="No transactions yet" message="Play a demo game to create activity." />
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
                      ['PAYOUT', 'BONUS'].includes(tx.type)
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
