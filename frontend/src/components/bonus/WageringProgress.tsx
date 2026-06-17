import { useEffect } from 'react'
import { Clock, X } from 'lucide-react'
import { useBonusStore } from '@/store/useBonusStore'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'
import type { UserBonus } from '@/types/bonus.types'

/**
 * Live wagering progress for the player's active bonuses. Progress updates in
 * real time via the socket (`bonus:progress`) wired in useSocket → bonus store.
 */
export default function WageringProgress({ compact = false }: { compact?: boolean }) {
  const active = useBonusStore((s) => s.active)
  const fetchActive = useBonusStore((s) => s.fetchActive)
  const cancel = useBonusStore((s) => s.cancel)

  useEffect(() => {
    void fetchActive()
  }, [fetchActive])

  const wagering = active.filter((b) => b.wagerRequired > 0)
  if (wagering.length === 0) {
    return compact ? null : (
      <p className="text-sm text-muted-foreground">No active wagering requirements.</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {wagering.map((b) => (
        <ProgressRow key={b.id} bonus={b} onCancel={() => cancel(b.id)} compact={compact} />
      ))}
    </div>
  )
}

function ProgressRow({
  bonus,
  onCancel,
  compact,
}: {
  bonus: UserBonus
  onCancel: () => void
  compact: boolean
}) {
  const pct = Math.min(100, bonus.wagerPercent)
  const expires = bonus.expiresAt ? new Date(bonus.expiresAt) : null
  const hoursLeft = expires ? Math.max(0, Math.round((expires.getTime() - Date.now()) / 3_600_000)) : null

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{bonus.name}</span>
          <Badge variant="gold">{bonus.kind}</Badge>
        </div>
        {!compact && (
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-destructive"
            title="Forfeit bonus"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light transition-all duration-500',
            pct >= 100 && 'from-emerald-500 to-emerald-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatCurrency(bonus.wagerProgress)} / {formatCurrency(bonus.wagerRequired)} wagered ({pct}%)
        </span>
        {hoursLeft != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {hoursLeft}h left
          </span>
        )}
      </div>
    </div>
  )
}
