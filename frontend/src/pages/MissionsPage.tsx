import { useState } from 'react'
import { Target } from 'lucide-react'
import MissionsList from '@/components/vip/MissionsList'
import VipProgressBar from '@/components/vip/VipProgressBar'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: undefined, label: 'All' },
  { key: 'DAILY', label: 'Daily' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'ACHIEVEMENT', label: 'Achievements' },
] as const

/**
 * Missions & challenges page. Shows the VIP progress bar up top (since missions
 * award status points) and a filterable mission list.
 */
export default function MissionsPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Target className="h-6 w-6 text-gold" /> Missions
        </h1>
        <p className="text-sm text-muted-foreground">Complete challenges to earn points and climb the VIP tiers.</p>
      </header>

      <VipProgressBar />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              filter === f.key ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <MissionsList filterType={filter} />
    </div>
  )
}
