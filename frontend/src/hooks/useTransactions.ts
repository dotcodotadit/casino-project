import { useEffect, useState } from 'react'
import { walletService } from '@/services/wallet.service'
import type { Transaction } from '@/types/wallet.types'

/** Convenience hook to load and expose the user's transaction list. */
export function useTransactions() {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    walletService
      .transactions({ pageSize: 50 })
      .then((res) => active && setData(res.items))
      .catch((err) => active && setError(err?.response?.data?.error?.message ?? 'Failed to load'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { data, loading, error }
}
