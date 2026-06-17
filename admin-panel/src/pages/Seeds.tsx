import { useEffect, useState } from 'react'
import { KeyRound, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/store/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import type { ServerSeed } from '@/types/admin.types'

export default function Seeds() {
  const [seeds, setSeeds] = useState<ServerSeed[]>([])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const push = useToast((s) => s.push)

  useEffect(() => {
    adminService.listSeeds().then(setSeeds)
  }, [])

  const rotate = async () => {
    setBusy(true)
    const { revealedHash } = await adminService.rotateSeed()
    setSeeds(await adminService.listSeeds())
    setBusy(false)
    setConfirm(false)
    push(revealedHash ? 'Seed rotated — previous seed revealed for verification' : 'New seed activated', 'success')
  }

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const active = seeds.find((s) => s.active)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Server Seed Management</h1>
          <p className="text-sm text-muted-foreground">
            Commit/reveal lifecycle. Rotating reveals the active seed (so past rounds become verifiable) and commits a fresh one.
          </p>
        </div>
        <Button onClick={() => setConfirm(true)}>
          <RefreshCw className="h-4 w-4" /> Rotate seed
        </Button>
      </div>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gold" /> Active commit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SHA-256 hash (published)</span>
              <Badge variant="success">ACTIVE</Badge>
            </div>
            <code className="block break-all rounded-md bg-background/60 p-3 font-mono text-xs">{active.seedHash}</code>
            <p className="text-xs text-muted-foreground">
              {active.roundsPlayed.toLocaleString()} rounds played · created {formatDate(active.createdAt)} · raw seed stays
              secret until rotation.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seed history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Revealed seed</TableHead>
                <TableHead>Rounds</TableHead>
                <TableHead>Rotated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seeds.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.active ? <Badge variant="success">ACTIVE</Badge> : <Badge variant="outline">RETIRED</Badge>}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs">{s.seedHash}</TableCell>
                  <TableCell>
                    {s.seed ? (
                      <div className="flex items-center gap-2">
                        <code className="max-w-[160px] truncate font-mono text-xs">
                          {revealed.has(s.id) ? s.seed : '•'.repeat(16)}
                        </code>
                        <button onClick={() => toggleReveal(s.id)} className="text-muted-foreground hover:text-foreground">
                          {revealed.has(s.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">sealed</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{s.roundsPlayed.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.rotatedAt ? formatDate(s.rotatedAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Rotate server seed?"
        description="This reveals the current active seed (making all its rounds verifiable) and activates a new committed seed. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="destructive" onClick={rotate} disabled={busy}>
            {busy ? 'Rotating…' : 'Confirm rotation'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
