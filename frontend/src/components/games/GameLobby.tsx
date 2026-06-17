import { Search } from 'lucide-react'
import { GameCard } from './GameCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingScreen } from '@/components/feedback/Spinner'
import { EmptyState, ErrorState } from '@/components/feedback/states'
import { cn } from '@/lib/utils'
import type { AggregatorProvider, GameCategory, GameFilters, LobbyGame, ProviderCode } from '@/types/aggregator.types'

const CATEGORIES: { id: GameCategory; label: string }[] = [
  { id: 'SLOTS', label: 'Slots' },
  { id: 'LIVE', label: 'Live' },
  { id: 'TABLE', label: 'Table' },
  { id: 'FISHING', label: 'Fishing' },
  { id: 'CRASH', label: 'Crash' },
]

interface GameLobbyProps {
  providers: AggregatorProvider[]
  games: LobbyGame[]
  filters: GameFilters
  loading: boolean
  error: string | null
  launching: string | null
  pageInfo: { page: number; totalPages: number; total: number }
  onFilter: (patch: Partial<GameFilters>) => void
  onPage: (page: number) => void
  onLaunch: (game: LobbyGame) => void
  onRetry: () => void
}

const chip = (active: boolean) =>
  cn(
    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
    active ? 'border-gold bg-gold/15 text-gold' : 'border-border text-muted-foreground hover:text-foreground',
  )

/** Provider/category/search filters + responsive game grid + pagination. */
export function GameLobby(p: GameLobbyProps) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={p.filters.q ?? ''}
          onChange={(e) => p.onFilter({ q: e.target.value || undefined })}
          placeholder="Search games…"
          className="pl-9"
        />
      </div>

      {/* Provider chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button className={chip(!p.filters.provider)} onClick={() => p.onFilter({ provider: undefined })}>
          All providers
        </button>
        {p.providers.map((pr) => (
          <button
            key={pr.code}
            className={chip(p.filters.provider === pr.code)}
            onClick={() => p.onFilter({ provider: pr.code as ProviderCode })}
          >
            {pr.name}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button className={chip(!p.filters.category)} onClick={() => p.onFilter({ category: undefined })}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={chip(p.filters.category === c.id)} onClick={() => p.onFilter({ category: c.id })}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {p.loading ? (
        <LoadingScreen label="Loading games…" />
      ) : p.error ? (
        <ErrorState message={p.error} onRetry={p.onRetry} />
      ) : p.games.length === 0 ? (
        <EmptyState title="No games found" message="Try a different provider or search term." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {p.games.map((g) => (
              <GameCard key={g.id} game={g} launching={p.launching === g.id} onLaunch={p.onLaunch} />
            ))}
          </div>

          {p.pageInfo.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={p.pageInfo.page <= 1} onClick={() => p.onPage(p.pageInfo.page - 1)}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                {p.pageInfo.page} / {p.pageInfo.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={p.pageInfo.page >= p.pageInfo.totalPages}
                onClick={() => p.onPage(p.pageInfo.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
