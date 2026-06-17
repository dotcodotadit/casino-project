import { useEffect, useState } from 'react'
import { FileBarChart, ShieldAlert, Check } from 'lucide-react'
import { bonusAdminService } from '@/services/bonus.admin.service'
import { useToast } from '@/store/useToast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ClaimRow, AbuseFlag } from '@/types/bonus.types'

/**
 * Bonus reporting: claim history (with wagering progress) + open anti-abuse
 * flags raised by the engine. Resolving a flag marks it reviewed.
 */
export default function BonusReport() {
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [flags, setFlags] = useState<AbuseFlag[]>([])
  const push = useToast((s) => s.push)

  const load = () => {
    bonusAdminService.claims(1).then((r) => setClaims(r.items))
    bonusAdminService.abuseFlags().then(setFlags)
  }
  useEffect(load, [])

  const resolve = async (id: string) => {
    await bonusAdminService.resolveAbuse(id)
    push('Flag resolved', 'success')
    setFlags((f) => f.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileBarChart className="h-6 w-6 text-gold" /> Bonus Report
        </h1>
        <p className="text-sm text-muted-foreground">Claim history & anti-abuse review</p>
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claim history</TabsTrigger>
          <TabsTrigger value="abuse">Abuse flags ({flags.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="claims">
          <div className="admin-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Wagering</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => {
                  const pct = c.wagerRequired > 0 ? Math.min(100, Math.round((c.wagerProgress / c.wagerRequired) * 100)) : 100
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.user}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{c.bonus}</div>
                        <Badge variant="outline">{c.kind}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'COMPLETED' ? 'success' : c.status === 'EXPIRED' ? 'warning' : 'default'}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatCurrency(c.granted)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.released > 0 ? formatCurrency(c.released) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="abuse">
          <div className="admin-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.length === 0 && (
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground">No open flags.</TableCell>
                  </TableRow>
                )}
                {flags.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="font-medium">{f.user}</div>
                      <div className="text-xs text-muted-foreground">{f.email}</div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <ShieldAlert className="h-4 w-4 text-amber-400" /> {f.reason}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.severity === 'HIGH' ? 'destructive' : f.severity === 'MEDIUM' ? 'warning' : 'outline'}>
                        {f.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {JSON.stringify(f.details)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => resolve(f.id)}>
                        <Check className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
