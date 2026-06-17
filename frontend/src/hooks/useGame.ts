import { useCallback, useEffect, useRef, useState } from 'react'
import { gameService } from '@/services/game.service'
import { useWalletStore } from '@/store/walletStore'
import type { BetHistoryItem, GameType } from '@/types/game.types'

interface UseGameOptions {
  game: GameType
  /** Auto-load bet history on mount. */
  loadHistory?: boolean
}

/**
 * Shared game hook. Centralizes:
 *  - busy/error state around an async bet action,
 *  - applying the authoritative post-bet balance to the wallet store,
 *  - per-game bet history with refresh.
 *
 * Real-time `balance:update` events are handled globally by useSocket (in
 * Layout); this hook also applies the balance returned synchronously so the UI
 * is correct even before the socket frame arrives.
 */
export function useGame({ game, loadHistory = true }: UseGameOptions) {
  const applyBalance = useWalletStore((s) => s.applyBalance)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<BetHistoryItem[]>([])

  // Guard against setState after the component using this hook unmounts
  // (e.g. navigating away mid-bet).
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const res = await gameService.history(game, 1, 10)
      if (mounted.current) setHistory(res.items)
    } catch {
      /* non-fatal */
    }
  }, [game])

  useEffect(() => {
    if (loadHistory) void refreshHistory()
  }, [loadHistory, refreshHistory])

  /**
   * Run a bet action. The action returns the post-bet state including
   * `balanceAfter`; we push it into the wallet store and refresh history.
   */
  const run = useCallback(
    async <T extends { balanceAfter: number }>(action: () => Promise<T>): Promise<T | null> => {
      setError(null)
      setBusy(true)
      try {
        const result = await action()
        applyBalance(result.balanceAfter)
        void refreshHistory()
        return result
      } catch (err: any) {
        if (mounted.current) setError(err?.response?.data?.error?.message ?? err?.message ?? 'Action failed')
        return null
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [applyBalance, refreshHistory],
  )

  return { busy, error, setError, history, refreshHistory, run }
}
