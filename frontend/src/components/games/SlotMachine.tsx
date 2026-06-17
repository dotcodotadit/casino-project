import { useEffect, useRef, useState } from 'react'
import { gameService } from '@/services/game.service'
import { useGame } from '@/hooks/useGame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { SlotsResult } from '@/types/game.types'

const PLACEHOLDER = Array.from({ length: 5 }, () => ['❔', '❔', '❔'])

/** Minimal sound hook placeholder — wire real audio assets later. */
function useSound() {
  return {
    play: (_name: 'spin' | 'win' | 'lose') => {
      /* TODO: new Audio(`/sounds/${_name}.mp3`).play() */
    },
  }
}

export default function SlotMachine() {
  const { busy, error, history, run } = useGame({ game: 'SLOTS' })
  const sound = useSound()
  const [stake, setStake] = useState('1.00')
  const [result, setResult] = useState<SlotsResult | null>(null)
  const [animating, setAnimating] = useState(false)
  const reelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending reveal timer on unmount to avoid setState-after-unmount.
  useEffect(() => () => {
    if (reelTimer.current) clearTimeout(reelTimer.current)
  }, [])

  const reels = result?.outcome.reels ?? PLACEHOLDER
  const won = (result?.payout ?? 0) > 0

  const spin = async () => {
    const stakeMinor = Math.round(parseFloat(stake || '0') * 100)
    if (!Number.isFinite(stakeMinor) || stakeMinor <= 0) return
    sound.play('spin')
    setAnimating(true)
    const res = await run<SlotsResult>(() => gameService.spinSlots(stakeMinor))
    // Brief spin animation before revealing.
    if (reelTimer.current) clearTimeout(reelTimer.current)
    reelTimer.current = setTimeout(() => {
      setAnimating(false)
      if (res) {
        setResult(res)
        sound.play(res.payout > 0 ? 'win' : 'lose')
      }
    }, 600)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🎰 Slot Machine</CardTitle>
          <p className="text-sm text-muted-foreground">5 reels · 3 rows · 5 paylines · 96% RTP</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-gold/30 bg-black/40 p-3 sm:gap-2 sm:p-4">
            {reels.map((reel, i) => (
              <div key={i} className="flex flex-col gap-1.5 sm:gap-2">
                {reel.map((sym, j) => (
                  <div
                    key={j}
                    className={`flex h-12 items-center justify-center rounded-md bg-card text-2xl transition-all sm:h-16 sm:text-3xl ${
                      animating ? 'animate-pulse blur-[1px]' : ''
                    }`}
                  >
                    {sym}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Stake (USD)</label>
              <Input
                type="number"
                min="0.10"
                step="0.10"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <Button size="lg" onClick={spin} disabled={busy || animating}>
              {busy || animating ? 'Spinning…' : 'SPIN'}
            </Button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {result && !animating && (
            <div className="space-y-1 rounded-lg border border-border bg-background/40 p-4 text-sm">
              <p>
                Payout:{' '}
                <span className={won ? 'font-semibold text-emerald-400' : 'text-muted-foreground'}>
                  {formatCurrency(result.payout)}
                </span>{' '}
                {won && <span className="text-gold">×{result.multiplier.toFixed(2)}</span>}
              </p>
              {result.outcome.bonusTriggered && <p className="text-gold">🎁 Bonus triggered!</p>}
              {result.outcome.freeSpinsAwarded > 0 && (
                <p className="text-royal-light">🌀 {result.outcome.freeSpinsAwarded} free spins</p>
              )}
              <p className="text-xs text-muted-foreground">
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

export function BetHistory({
  history,
}: {
  history: { id: string; stake: number; payout: number; createdAt: string }[]
}) {
  if (history.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent bets</h3>
      <ul className="divide-y divide-border text-sm">
        {history.map((h) => (
          <li key={h.id} className="flex justify-between py-1.5">
            <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleTimeString()}</span>
            <span>
              {formatCurrency(h.stake)} →{' '}
              <span className={h.payout > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>
                {formatCurrency(h.payout)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
