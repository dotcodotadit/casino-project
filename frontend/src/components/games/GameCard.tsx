import { Play, Wrench, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LobbyGame, ProviderCode } from '@/types/aggregator.types'

const providerTint: Record<ProviderCode, string> = {
  PGSOFT: 'from-amber-600/40 to-amber-900/40',
  PRAGMATIC: 'from-orange-600/40 to-rose-900/40',
  EVOLUTION: 'from-indigo-600/40 to-purple-900/40',
  JILI: 'from-emerald-600/40 to-teal-900/40',
}

interface GameCardProps {
  game: LobbyGame
  launching: boolean
  onLaunch: (game: LobbyGame) => void
}

/** A single game tile — thumbnail (or branded fallback), provider, RTP, play. */
export function GameCard({ game, launching, onLaunch }: GameCardProps) {
  const disabled = game.maintenance || launching
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onLaunch(game)}
      className={cn(
        'group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-border text-left transition-all',
        !disabled && 'hover:border-gold/60 hover:shadow-gold',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      {/* Thumbnail or branded gradient fallback */}
      {game.thumbnailUrl ? (
        <img src={game.thumbnailUrl} alt={game.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className={cn('absolute inset-0 bg-gradient-to-br', providerTint[game.provider.code])}>
          <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">🎮</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Top badges */}
      <div className="absolute left-2 top-2 flex gap-1">
        <Badge variant="gold">{game.provider.code}</Badge>
      </div>
      {game.rtp != null && (
        <div className="absolute right-2 top-2">
          <Badge variant="outline">{(game.rtp * 100).toFixed(1)}%</Badge>
        </div>
      )}

      {/* Maintenance overlay */}
      {game.maintenance && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/70 text-center">
          <Wrench className="h-5 w-5 text-amber-400" />
          <span className="text-xs text-amber-300">Maintenance</span>
        </div>
      )}

      {/* Footer + hover play */}
      <div className="relative z-[1] p-3">
        <p className="truncate text-sm font-semibold">{game.name}</p>
        <p className="text-[11px] text-muted-foreground">{game.provider.name}</p>
      </div>
      {!disabled && (
        <span className="absolute inset-0 z-[1] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-gold">
            <Play className="h-5 w-5 translate-x-0.5" />
          </span>
        </span>
      )}
      {launching && (
        <span className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </span>
      )}
    </button>
  )
}
