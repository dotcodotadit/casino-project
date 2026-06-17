import { useState } from 'react'
import { useAggregator } from '@/hooks/useAggregator'
import { useWalletStore } from '@/store/walletStore'
import { GameLobby } from '@/components/games/GameLobby'
import { GameLauncher } from '@/components/games/GameLauncher'
import type { LaunchResult, LobbyGame } from '@/types/aggregator.types'

/**
 * Provider games hub. Shows the filterable lobby; launching a game opens the
 * full-screen GameLauncher overlay. Closing it returns to the lobby and refreshes
 * the wallet (bets/wins were applied server-side via callbacks while playing).
 */
export default function AggregatorGames() {
  const agg = useAggregator()
  const fetchWallet = useWalletStore((s) => s.fetchWallet)
  const [active, setActive] = useState<LaunchResult | null>(null)

  const onLaunch = async (game: LobbyGame) => {
    const result = await agg.launch(game)
    if (result) setActive(result)
  }

  const onClose = () => {
    setActive(null)
    void fetchWallet()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game Library</h1>
        <p className="text-sm text-muted-foreground">
          {agg.pageInfo.total} games across {agg.providers.length} providers · seamless wallet
        </p>
      </div>

      <GameLobby
        providers={agg.providers}
        games={agg.games}
        filters={agg.filters}
        loading={agg.loading}
        error={agg.error}
        launching={agg.launching}
        pageInfo={agg.pageInfo}
        onFilter={agg.updateFilters}
        onPage={agg.setPage}
        onLaunch={onLaunch}
        onRetry={agg.reload}
      />

      {active && <GameLauncher launch={active} onClose={onClose} />}
    </div>
  )
}
