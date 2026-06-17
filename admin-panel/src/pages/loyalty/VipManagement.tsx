import { useEffect, useState } from 'react'
import { Crown, Coins, TrendingUp, Save, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { loyaltyAdminService } from '@/services/loyalty.admin.service'
import { useToast } from '@/store/useToast'
import { StatCard } from '@/components/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCompact, formatPercent } from '@/lib/utils'
import type { AdminVipLevel, LoyaltyAnalytics, PointConfig, LevelFormData } from '@/types/loyalty.types'
import LevelForm from './LevelForm'

/**
 * VIP management: analytics summary, level-distribution chart, point-rate config
 * (hot-reloadable), and the editable tier ladder. Backed by loyaltyAdminService
 * (live API + fixture fallback).
 */
export default function VipManagement() {
  const [levels, setLevels] = useState<AdminVipLevel[]>([])
  const [analytics, setAnalytics] = useState<LoyaltyAnalytics | null>(null)
  const [pointCfg, setPointCfg] = useState<PointConfig | null>(null)
  const [editing, setEditing] = useState<AdminVipLevel | null>(null)
  const [creating, setCreating] = useState(false)
  const push = useToast((s) => s.push)

  const load = () => {
    loyaltyAdminService.levels().then(setLevels)
    loyaltyAdminService.analytics().then(setAnalytics)
    loyaltyAdminService.pointConfig().then(setPointCfg)
  }
  useEffect(load, [])

  const savePoints = async () => {
    if (!pointCfg) return
    await loyaltyAdminService.savePointConfig(pointCfg)
    push('Point configuration saved', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Crown className="h-6 w-6 text-gold" /> VIP Management
          </h1>
          <p className="text-sm text-muted-foreground">Tier ladder, point rates & loyalty analytics</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New level
        </Button>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Points issued" value={formatCompact(analytics.totalPointsIssued)} icon={Coins} />
          <StatCard label="Points redeemed" value={formatCompact(analytics.totalPointsRedeemed)} icon={TrendingUp} />
          <StatCard label="Redemption rate" value={formatPercent(analytics.redemptionRate)} />
          <StatCard label="Total redemptions" value={String(analytics.totalRedemptions)} />
        </div>
      )}

      {/* Level distribution */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle>Level distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.levelDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} />
                <Bar dataKey="players" fill="#d4af37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Point configuration */}
      {pointCfg && (
        <Card>
          <CardHeader>
            <CardTitle>Point configuration</CardTitle>
            <p className="text-xs text-muted-foreground">
              Points = stake (minor) × category weight × tier multiplier × rate. Changes apply without redeploy.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumField label="Loyalty / stake" value={pointCfg.loyaltyPerStakeMinor} onChange={(v) => setPointCfg({ ...pointCfg, loyaltyPerStakeMinor: v })} />
              <NumField label="Status / stake" value={pointCfg.statusPerStakeMinor} onChange={(v) => setPointCfg({ ...pointCfg, statusPerStakeMinor: v })} />
              <NumField label="Loyalty / deposit" value={pointCfg.loyaltyPerDepositMinor} onChange={(v) => setPointCfg({ ...pointCfg, loyaltyPerDepositMinor: v })} />
              <NumField label="Status / deposit" value={pointCfg.statusPerDepositMinor} onChange={(v) => setPointCfg({ ...pointCfg, statusPerDepositMinor: v })} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Category weights</p>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(pointCfg.categoryWeights).map(([cat, w]) => (
                  <NumField
                    key={cat}
                    label={cat}
                    value={w}
                    onChange={(v) => setPointCfg({ ...pointCfg, categoryWeights: { ...pointCfg.categoryWeights, [cat]: v } })}
                  />
                ))}
              </div>
            </div>
            <Button onClick={savePoints}>
              <Save className="h-4 w-4" /> Save point config
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tier ladder */}
      <Card>
        <CardHeader>
          <CardTitle>Tier ladder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {levels.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5" style={{ color: l.color ?? '#d4af37' }} />
                  <div>
                    <p className="font-medium">
                      Lv{l.level} · {l.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCompact(l.requiredPoints)} pts · keep {formatCompact(l.keepPoints)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="gold">{l.pointMultiplier}×</Badge>
                  <Badge variant="outline">{l.cashbackPct}% cashback</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <LevelForm
          level={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
            push('Level saved', 'success')
          }}
        />
      )}
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  )
}

export type { LevelFormData }
