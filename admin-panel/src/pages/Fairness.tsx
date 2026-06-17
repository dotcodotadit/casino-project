import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldX, Loader2, Play } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/store/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import type { FairRound } from '@/types/admin.types'

type Verdict = 'pending' | 'verifying' | 'pass' | 'fail'

export default function Fairness() {
  const [rounds, setRounds] = useState<FairRound[]>([])
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [running, setRunning] = useState(false)
  const push = useToast((s) => s.push)

  useEffect(() => {
    adminService.listFairRounds().then(setRounds)
  }, [])

  const verifyOne = async (r: FairRound): Promise<Verdict> => {
    const ok = await adminService.verifyCommit(r.serverSeed, r.serverSeedHash)
    return ok ? 'pass' : 'fail'
  }

  const massVerify = async () => {
    setRunning(true)
    setVerdicts(Object.fromEntries(rounds.map((r) => [r.id, 'verifying'])))
    let pass = 0
    for (const r of rounds) {
      const v = await verifyOne(r)
      if (v === 'pass') pass++
      setVerdicts((prev) => ({ ...prev, [r.id]: v }))
    }
    setRunning(false)
    push(`Verified ${rounds.length} rounds · ${pass} passed, ${rounds.length - pass} failed`, pass === rounds.length ? 'success' : 'error')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provably Fair Verifier</h1>
        <p className="text-sm text-muted-foreground">
          Confirms each revealed server seed hashes (SHA-256) to its published commit. Recomputation runs locally in your browser.
        </p>
      </div>

      <ManualVerifier />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Round audit ({rounds.length})</CardTitle>
            <Button onClick={massVerify} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Verifying…' : 'Mass verify'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Nonce</TableHead>
                <TableHead>Stake</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => {
                const v = verdicts[r.id] ?? 'pending'
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.username}</TableCell>
                    <TableCell><Badge variant="outline">{r.game}</Badge></TableCell>
                    <TableCell className="font-mono">{r.nonce}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(r.stakeMinor)}</TableCell>
                    <TableCell className={r.payoutMinor > 0 ? 'font-mono text-success' : 'font-mono text-muted-foreground'}>
                      {formatCurrency(r.payoutMinor)}
                    </TableCell>
                    <TableCell>
                      {v === 'pass' && <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" />Valid</Badge>}
                      {v === 'fail' && <Badge variant="destructive"><ShieldX className="mr-1 h-3 w-3" />Invalid</Badge>}
                      {v === 'verifying' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {v === 'pending' && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ManualVerifier() {
  const [seed, setSeed] = useState('')
  const [hash, setHash] = useState('')
  const [result, setResult] = useState<null | boolean>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!seed || !hash) return
    setBusy(true)
    const ok = await adminService.verifyCommit(seed.trim(), hash.trim())
    setResult(ok)
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual verify</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Revealed server seed" value={seed} onChange={(e) => setSeed(e.target.value)} />
          <Input placeholder="Published server seed hash (sha256)" value={hash} onChange={(e) => setHash(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={run} disabled={busy}>
            {busy ? 'Checking…' : 'Verify'}
          </Button>
          {result === true && <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" />Match — provably fair</Badge>}
          {result === false && <Badge variant="destructive"><ShieldX className="mr-1 h-3 w-3" />Mismatch</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}
