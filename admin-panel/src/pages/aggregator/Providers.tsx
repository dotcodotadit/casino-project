import { useEffect, useState } from 'react'
import { Plug, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react'
import { aggregatorAdminService } from '@/services/aggregator.admin.service'
import { useToast } from '@/store/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import type { AdminProvider, ProviderStatus } from '@/types/aggregator.types'

const statusVariant: Record<ProviderStatus, 'success' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  DISABLED: 'destructive',
}

export default function Providers() {
  const [providers, setProviders] = useState<AdminProvider[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const push = useToast((s) => s.push)

  useEffect(() => {
    aggregatorAdminService.listProviders().then(setProviders)
  }, [])

  const setStatus = async (p: AdminProvider, status: ProviderStatus) => {
    const updated = await aggregatorAdminService.setProviderStatus(p.code, status)
    setProviders((prev) => prev.map((x) => (x.code === p.code ? { ...x, status: updated.status } : x)))
    push(`${p.name} → ${status}`, status === 'ACTIVE' ? 'success' : 'info')
  }

  const sync = async (p: AdminProvider) => {
    setSyncing(p.code)
    const res = await aggregatorAdminService.syncGames(p.code)
    setSyncing(null)
    push(`Imported ${res.synced} games from ${p.name}`, 'success')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-sm text-muted-foreground">Enable/disable, maintenance, credentials &amp; game import</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.code}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-gold" /> {p.name}
                </CardTitle>
                <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.code}
                {p.aggregator ? ` · via ${p.aggregator}` : ''} · {p.gamesCount} games
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                Credentials: {p.hasCredentials ? <span className="text-emerald-400">encrypted ✓</span> : <span className="text-destructive">missing</span>}
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5" />
                <span>
                  IP allowlist:{' '}
                  {p.callbackIpWhitelist.length ? p.callbackIpWhitelist.join(', ') : <span className="text-amber-400">open (dev)</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Select value={p.status} onChange={(e) => setStatus(p, e.target.value as ProviderStatus)} className="w-40">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="DISABLED">DISABLED</option>
                </Select>
                <Button variant="outline" size="sm" disabled={syncing === p.code} onClick={() => sync(p)}>
                  <RefreshCw className={syncing === p.code ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Import games
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
