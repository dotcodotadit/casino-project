import { useCallback, useEffect, useState } from 'react'
import { walletService } from '@/services/wallet.service'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionType, PaginatedTransactions } from '@/types/wallet.types'

const TYPE_FILTERS: ('ALL' | TransactionType)[] = ['ALL', 'DEPOSIT', 'WITHDRAW', 'BET', 'PAYOUT']

const statusColor: Record<string, string> = {
  COMPLETED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  FAILED: 'text-red-400',
  CANCELLED: 'text-muted-foreground',
}

// Credit vs debit sign for display.
const CREDIT_TYPES = new Set(['DEPOSIT', 'PAYOUT', 'BONUS', 'TRANSFER_IN'])

/** Paginated, filterable transaction history (server-side filter + pagination). */
export function TransactionHistory() {
  const [filter, setFilter] = useState<'ALL' | TransactionType>('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedTransactions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await walletService.transactions({
        type: filter === 'ALL' ? undefined : filter,
        page,
        pageSize: 10,
      })
      setData(res)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    void load()
  }, [load])

  const items: Transaction[] = data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setPage(1)
              setFilter(f)
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              filter === f ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="py-6 text-center text-sm text-red-400">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
      )}

      <ul className="divide-y divide-border">
        {items.map((tx) => {
          const credit = CREDIT_TYPES.has(tx.type)
          return (
            <li key={tx.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium">{tx.type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('font-mono font-semibold', credit ? 'text-emerald-400' : 'text-foreground')}>
                  {credit ? '+' : '−'}
                  {formatCurrency(tx.amount)}
                </p>
                <p className={cn('text-xs', statusColor[tx.status] ?? 'text-muted-foreground')}>
                  {tx.status}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md px-3 py-1 text-muted-foreground disabled:opacity-40 hover:text-foreground"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">
            Page {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md px-3 py-1 text-muted-foreground disabled:opacity-40 hover:text-foreground"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
