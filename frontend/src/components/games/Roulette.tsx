import { useState } from 'react'
import { gameService } from '@/services/game.service'
import { useGame } from '@/hooks/useGame'
import { BetHistory } from './SlotMachine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import type { RouletteResult, RouletteVariant, RouletteBetKind } from '@/types/game.types'

const OUTSIDE: { kind: RouletteBetKind; label: string }[] = [
  { kind: 'RED', label: 'Red' },
  { kind: 'BLACK', label: 'Black' },
  { kind: 'EVEN', label: 'Even' },
  { kind: 'ODD', label: 'Odd' },
  { kind: 'LOW', label: '1-18' },
  { kind: 'HIGH', label: '19-36' },
]

export default function Roulette() {
  const { busy, error, history, run } = useGame({ game: 'ROULETTE' })
  const [variant, setVariant] = useState<RouletteVariant>('EUROPEAN')
  const [stake, setStake] = useState('1.00')
  const [betKind, setBetKind] = useState<RouletteBetKind>('RED')
  const [straight, setStraight] = useState('0')
  const [result, setResult] = useState<RouletteResult | null>(null)
  const [spinning, setSpinning] = useState(false)

  const spin = async () => {
    const stakeMinor = Math.round(parseFloat(stake || '0') * 100)
    if (!Number.isFinite(stakeMinor) || stakeMinor <= 0) return
    setSpinning(true)
    const res = await run<RouletteResult>(() =>
      gameService.spinRoulette({
        stakeMinor,
        variant,
        bet: { kind: betKind, number: betKind === 'STRAIGHT' ? Number(straight) : undefined },
      }),
    )
    setTimeout(() => {
      setSpinning(false)
      if (res) setResult(res)
    }, 700)
  }

  const color = result?.outcome.color
  const won = (result?.payout ?? 0) > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🎡 Roulette</CardTitle>
          <div className="mt-2 flex gap-2">
            {(['EUROPEAN', 'AMERICAN'] as RouletteVariant[]).map((v) => (
              <Button key={v} size="sm" variant={variant === v ? 'default' : 'outline'} onClick={() => setVariant(v)}>
                {v}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div
              className={cn(
                'flex h-28 w-28 items-center justify-center rounded-full border-4 text-4xl font-black transition-transform',
                spinning && 'animate-spin',
                color === 'red' && 'border-red-500 bg-red-500/20 text-red-300',
                color === 'black' && 'border-zinc-500 bg-zinc-800 text-zinc-100',
                color === 'green' && 'border-emerald-500 bg-emerald-600/20 text-emerald-300',
                !result && 'border-gold/40 text-muted-foreground',
              )}
            >
              {spinning ? '🎡' : result ? result.outcome.pocket : '?'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {OUTSIDE.map((b) => (
              <Button key={b.kind} variant={betKind === b.kind ? 'default' : 'outline'} onClick={() => setBetKind(b.kind)}>
                {b.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant={betKind === 'STRAIGHT' ? 'default' : 'outline'} onClick={() => setBetKind('STRAIGHT')}>
              Straight #
            </Button>
            <Input
              type="number"
              min="0"
              max="36"
              value={straight}
              onChange={(e) => setStraight(e.target.value)}
              className="w-24"
              disabled={betKind !== 'STRAIGHT'}
            />
            <span className="text-xs text-muted-foreground">pays 35:1</span>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Stake (USD)</label>
              <Input type="number" min="0.10" step="0.10" value={stake} onChange={(e) => setStake(e.target.value)} />
            </div>
            <Button size="lg" onClick={spin} disabled={busy || spinning}>
              {busy || spinning ? 'Spinning…' : 'SPIN'}
            </Button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {result && !spinning && (
            <div className="rounded-lg border border-border bg-background/40 p-4 text-sm">
              <p>
                Result <span className="font-semibold">{result.outcome.pocket}</span> ({result.outcome.color}) · payout{' '}
                <span className={won ? 'text-emerald-400' : 'text-muted-foreground'}>{formatCurrency(result.payout)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Provably fair · hash {result.fairness.serverSeedHash.slice(0, 12)}… · nonce {result.fairness.nonce}
              </p>
            </div>
          )}

          <BetHistory history={history} />
        </CardContent>
      </Card>
    </div>
  )
}
