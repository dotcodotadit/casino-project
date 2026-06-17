import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { gameService } from '@/services/game.service'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/feedback/states'
import type { FairnessInfo } from '@/types/game.types'

const GAMES = [
  { to: '/games/slots', emoji: '🎰', name: 'Slots', desc: '5×3 reels · free spins · 96% RTP' },
  { to: '/games/roulette', emoji: '🎡', name: 'Roulette', desc: 'European & American · up to 35:1' },
  { to: '/games/blackjack', emoji: '🃏', name: 'Blackjack', desc: 'Single deck · blackjack pays 3:2' },
]

/** Game lobby — entry point to all games + provably-fair status. */
export default function Casino() {
  const [fairness, setFairness] = useState<FairnessInfo | null>(null)

  useEffect(() => {
    let active = true
    gameService
      .fairness()
      .then((f) => active && setFairness(f))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="text-gold-gradient text-3xl font-black sm:text-4xl">Casino</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every round is provably fair — verify the seed &amp; nonce after each bet.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link key={g.to} to={g.to} className="group">
            <Card className="h-full transition-colors group-hover:border-gold/50">
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <span className="text-5xl">{g.emoji}</span>
                <h2 className="text-lg font-bold">{g.name}</h2>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p className="font-semibold uppercase">Provably fair</p>
          {fairness ? (
            <>
              <p>
                Server seed hash:{' '}
                <span className="font-mono text-foreground">{fairness.serverSeedHash.slice(0, 24)}…</span>
              </p>
              <p>
                Your client seed: <span className="font-mono text-foreground">{fairness.clientSeed}</span> · next nonce{' '}
                {fairness.nextNonce}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
