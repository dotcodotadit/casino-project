import { useState } from 'react'
import { Bitcoin, Banknote } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DepositMethod } from '@/types/wallet.types'

const METHODS: { value: DepositMethod; label: string; crypto: boolean }[] = [
  { value: 'CRYPTO_BTC', label: 'Bitcoin', crypto: true },
  { value: 'CRYPTO_ETH', label: 'Ethereum', crypto: true },
  { value: 'CRYPTO_USDT', label: 'USDT', crypto: true },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', crypto: false },
]

/** Simulated deposit form: pick a method + amount, credits instantly (demo). */
export function DepositForm() {
  const deposit = useWalletStore((s) => s.deposit)
  const [method, setMethod] = useState<DepositMethod>('CRYPTO_USDT')
  const [amount, setAmount] = useState('50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const minor = Math.round(parseFloat(amount || '0') * 100)
    if (!Number.isFinite(minor) || minor <= 0) {
      setError('Enter a positive amount')
      return
    }
    setBusy(true)
    try {
      await deposit(minor, method)
      setSuccess('Deposit credited (simulation).')
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Deposit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              method === m.value
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {m.crypto ? <Bitcoin className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
            {m.label}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Amount (USD)</label>
        <Input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Processing…' : 'Deposit'}
      </Button>
    </form>
  )
}
