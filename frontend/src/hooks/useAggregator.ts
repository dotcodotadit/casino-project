import { useCallback, useEffect, useRef, useState } from 'react'
import { aggregatorService } from '@/services/aggregator.service'
import { useWalletStore } from '@/store/walletStore'
import { notify } from '@/store/useNotifications'
import type { AggregatorProvider, LobbyGame, PaginatedGames, GameFilters, LaunchResult } from '@/types/aggregator.types'

/**
 * Drives the aggregator lobby: loads providers + a filtered/paginated game list,
 * and exposes a `launch` action. On launch it also refreshes the wallet so the
 * header balance is current before the player enters the game.
 */
export function useAggregator() {
  const fetchWallet = useWalletStore((s) => s.fetchWallet)
  const [providers, setProviders] = useState<AggregatorProvider[]>([])
  const [games, setGames] = useState<LobbyGame[]>([])
  const [pageInfo, setPageInfo] = useState<Omit<PaginatedGames, 'items'>>({ page: 1, pageSize: 24, total: 0, totalPages: 1 })
  const [filters, setFilters] = useState<GameFilters>({ page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState<string | null>(null) // game id being launched

  // Avoid races from rapid filter changes — only the latest request wins.
  const reqId = useRef(0)

  useEffect(() => {
    aggregatorService.getProviders().then(setProviders).catch(() => {})
  }, [])

  const loadGames = useCallback(async () => {
    const myReq = ++reqId.current
    setLoading(true)
    setError(null)
    try {
      const res = await aggregatorService.getGames(filters)
      if (myReq !== reqId.current) return // stale
      setGames(res.items)
      setPageInfo({ page: res.page, pageSize: res.pageSize, total: res.total, totalPages: res.totalPages })
    } catch (err: any) {
      if (myReq === reqId.current) setError(err?.response?.data?.error?.message ?? 'Failed to load games')
    } finally {
      if (myReq === reqId.current) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadGames()
  }, [loadGames])

  const updateFilters = useCallback((patch: Partial<GameFilters>) => {
    // Any filter change (except page) resets to page 1.
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }))
  }, [])

  const launch = useCallback(
    async (game: LobbyGame): Promise<LaunchResult | null> => {
      setLaunching(game.id)
      try {
        const result = await aggregatorService.launch(game.provider.code, game.externalId)
        await fetchWallet()
        return result
      } catch (err: any) {
        notify({
          title: 'Could not launch game',
          message: err?.response?.data?.error?.message ?? 'Please try again',
          variant: 'error',
        })
        return null
      } finally {
        setLaunching(null)
      }
    },
    [fetchWallet],
  )

  return { providers, games, pageInfo, filters, loading, error, launching, updateFilters, setPage: (page: number) => updateFilters({ page }), launch, reload: loadGames }
}
