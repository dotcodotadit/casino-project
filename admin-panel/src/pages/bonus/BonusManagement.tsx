import { useEffect, useState } from 'react'
import { Gift, Plus, Pause, Play, Pencil, AlertTriangle, TrendingUp } from 'lucide-react'
import { bonusAdminService } from '@/services/bonus.admin.service'
import { useToast } from '@/store/useToast'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { AdminBonus, BonusAnalytics } from '@/types/bonus.types'
import BonusForm from './BonusForm'

/**
 * Bonus management: list + analytics summary + create/edit/pause/activate.
 * Backed by bonusAdminService (live /api/bonus/admin with fixture fallback).
 */
export default function BonusManagement() {
  const [bonuses, setBonuses] = useState<AdminBonus[]>([])
  const [analytics, setAnalytics] = useState<BonusAnalytics | null>(null)
  const [editing, setEditing] = useState<AdminBonus | null>(null)
  const [creating, setCreating] = useState(false)
  const push = useToast((s) => s.push)

  const load = () => {
    bonusAdminService.list().then(setBonuses)
    bonusAdminService.analytics().then(setAnalytics)
  }
  useEffect(load, [])

  const toggleStatus = async (b: AdminBonus) => {
    const next = b.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    await bonusAdminService.setStatus(b.id, next)
    push(`${b.name} ${next === 'ACTIVE' ? 'activated' : 'paused'}`, 'success')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6 text-gold" /> Bonus Management
          </h1>
          <p className="text-sm text-muted-foreground">Create, configure & monitor bonus campaigns</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New bonus
        </Button>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total granted" value={formatCurrency(analytics.totalGranted)} icon={Gift} />
          <StatCard label="Released to players" value={formatCurrency(analytics.totalReleased)} icon={TrendingUp} />
          <StatCard label="Conversion rate" value={formatPercent(analytics.conversionRate)} hint="released / granted" />
          <StatCard label="Open abuse flags" value={String(analytics.openAbuseFlags)} icon={AlertTriangle} />
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Wager</TableHead>
              <TableHead>Claims</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bonuses.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.name}</div>
                  {b.code && <div className="text-xs text-muted-foreground">Code: {b.code}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="gold">{b.kind}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {b.rewardType === 'PERCENTAGE'
                    ? `${Math.round((b.percentage ?? 0) * 100)}%${b.maxAmount ? ` ≤ ${formatCurrency(b.maxAmount)}` : ''}`
                    : b.rewardType === 'FREE_SPINS'
                      ? 'Free spins'
                      : b.maxAmount
                        ? formatCurrency(b.maxAmount)
                        : '—'}
                </TableCell>
                <TableCell className="text-sm">{b.wagerMultiplier > 0 ? `${b.wagerMultiplier}×` : '—'}</TableCell>
                <TableCell className="text-sm">{b.claims}</TableCell>
                <TableCell>
                  <Badge
                    variant={b.status === 'ACTIVE' ? 'success' : b.status === 'PAUSED' ? 'warning' : 'outline'}
                  >
                    {b.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(b)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(b)} title="Toggle status">
                      {b.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <BonusForm
          bonus={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
            push('Bonus saved', 'success')
          }}
        />
      )}
    </div>
  )
}
