import { useEffect, useMemo } from 'react'
import { Target, CheckCircle2, Trophy } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Mission } from '@/types/loyalty.types'

const TYPE_LABEL: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ACHIEVEMENT: 'Achievement',
  TIER: 'VIP',
}

/**
 * Player missions grouped by type. Progress bars update live via the loyalty
 * store (mission:progress / mission:completed socket events). Completed missions
 * expose a Claim button.
 */
export default function MissionsList({ filterType }: { filterType?: string }) {
  const missions = useLoyaltyStore((s) => s.missions)
  const fetchMissions = useLoyaltyStore((s) => s.fetchMissions)
  const claimMission = useLoyaltyStore((s) => s.claimMission)
  const claiming = useLoyaltyStore((s) => s.claiming)

  useEffect(() => {
    void fetchMissions()
  }, [fetchMissions])

  const groups = useMemo(() => {
    const filtered = filterType ? missions.filter((m) => m.type === filterType) : missions
    const byType: Record<string, Mission[]> = {}
    for (const m of filtered) (byType[m.type] ??= []).push(m)
    return byType
  }, [missions, filterType])

  const order = ['DAILY', 'WEEKLY', 'MONTHLY', 'TIER', 'ACHIEVEMENT']
  const types = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b))

  if (types.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
        No missions available right now.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {types.map((type) => (
        <section key={type}>
          {!filterType && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{TYPE_LABEL[type] ?? type}</h3>}
          <div className="grid gap-3 sm:grid-cols-2">
            {groups[type].map((m) => (
              <MissionCard key={m.id} m={m} busy={claiming === m.id} onClaim={() => claimMission(m.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MissionCard({ m, busy, onClaim }: { m: Mission; busy: boolean; onClaim: () => void }) {
  const done = m.status === 'COMPLETED'
  const claimed = m.status === 'CLAIMED'
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', done && 'border-gold/40')}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{m.name}</p>
          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
        </div>
        <Badge variant={claimed ? 'success' : 'gold'}>+{m.rewardPoints} pts</Badge>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', done ? 'bg-emerald-400' : 'bg-gold')}
          style={{ width: `${m.percent}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {m.progress.toLocaleString()} / {m.target.toLocaleString()} ({m.percent}%)
        </span>
        {claimed ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Claimed
          </span>
        ) : done ? (
          <Button size="sm" disabled={busy} onClick={onClaim}>
            <Trophy className="h-3.5 w-3.5" /> {busy ? 'Claiming…' : 'Claim'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
