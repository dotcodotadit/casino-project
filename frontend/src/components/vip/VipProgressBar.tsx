import { Crown } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { cn } from '@/lib/utils'

/**
 * Compact VIP progress bar — current tier, points to next, and a fill bar.
 * Reads live state from the loyalty store (kept fresh by socket events).
 */
export default function VipProgressBar({ className }: { className?: string }) {
  const progress = useLoyaltyStore((s) => s.progress)
  if (!progress) return null

  return (
    <div className={cn('rounded-lg border border-border bg-card/60 p-3', className)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: progress.color ?? undefined }}>
          <Crown className="h-4 w-4" /> {progress.levelName}
        </span>
        <span className="text-xs text-muted-foreground">
          {progress.statusPoints.toLocaleString()} pts
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light transition-all duration-500"
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs text-muted-foreground">
        {progress.nextLevel
          ? `${progress.pointsToNext.toLocaleString()} pts to ${progress.nextLevel.name}`
          : 'Max tier reached'}
      </div>
    </div>
  )
}
