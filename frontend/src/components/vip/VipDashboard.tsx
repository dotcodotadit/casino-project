import { useEffect } from 'react'
import { Crown, Gem, Coins } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import VipBenefits from './VipBenefits'
import { cn } from '@/lib/utils'

/**
 * VIP dashboard: hero tier card with live progress to the next tier, key stats,
 * the full tier ladder, and current-tier benefits. State comes from the loyalty
 * store (kept live by socket events).
 */
export default function VipDashboard() {
  const progress = useLoyaltyStore((s) => s.progress)
  const levels = useLoyaltyStore((s) => s.levels)
  const fetchVip = useLoyaltyStore((s) => s.fetchVip)

  useEffect(() => {
    void fetchVip()
  }, [fetchVip])

  if (!progress) {
    return <p className="text-sm text-muted-foreground">Loading your VIP status…</p>
  }

  return (
    <div className="space-y-8">
      {/* Hero tier card */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-royal-dark/50 to-card p-6">
        <Crown className="absolute -right-4 -top-4 h-32 w-32 text-gold/10" />
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
            <Crown className="h-7 w-7 text-gold" style={{ color: progress.color ?? undefined }} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Current tier</p>
            <h2 className="text-2xl font-bold text-gold-gradient">{progress.levelName}</h2>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.nextLevel ? `Progress to ${progress.nextLevel.name}` : 'Max tier reached'}
            </span>
            <span className="font-medium">{progress.progressPercent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light transition-all duration-700"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          {progress.nextLevel && (
            <p className="mt-1.5 text-right text-xs text-muted-foreground">
              {progress.pointsToNext.toLocaleString()} status points to go
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat icon={Coins} label="Loyalty points" value={progress.loyaltyPoints.toLocaleString()} />
          <Stat icon={Gem} label="Status points" value={progress.statusPoints.toLocaleString()} />
          <Stat icon={Crown} label="Point multiplier" value={`${progress.pointMultiplier}×`} />
        </div>
      </div>

      {/* Tier ladder */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">Tier ladder</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {levels.map((l) => (
            <div
              key={l.id}
              className={cn(
                'flex min-w-[120px] flex-col items-center rounded-lg border p-3 text-center',
                l.level === progress.level ? 'border-gold bg-gold/10' : 'border-border bg-card',
              )}
            >
              <Crown
                className="h-5 w-5"
                style={{ color: l.level <= progress.level ? (l.color ?? '#d4af37') : undefined }}
              />
              <span className="mt-1 text-sm font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.requiredPoints.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">Your benefits</h3>
        <VipBenefits />
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Crown; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-gold" />
      <p className="text-sm font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
