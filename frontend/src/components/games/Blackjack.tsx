import { useState } from 'react'
import { gameService } from '@/services/game.service'
import { useGame } from '@/hooks/useGame'
import { BetHistory } from './SlotMachine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { BlackjackState, Hand, BlackjackStatus } from '@/types/game.types'

function statusLabel(status: BlackjackStatus): string {
  switch (status) {
    case 'PLAYER_BLACKJACK':
      return 'Blackjack! You win 🎉'
    case 'PLAYER_WIN':
      return 'You win 🎉'
    case 'DEALER_WIN':
      return 'Dealer wins'
    case 'PUSH':
      return 'Push — bet returned'
    default:
      return ''
  }
}

function CardFace({ card, hidden }: { card?: { rank: string; suit: string }; hidden?: boolean }) {
  const red = card && (card.suit === '♥' || card.suit === '♦')
  return (
    <div
      className={`flex h-20 w-14 items-center justify-center rounded-lg border text-xl font-bold shadow-sm sm:h-24 sm:w-16 sm:text-2xl ${
        hidden ? 'bg-royal-dark text-royal-light' : 'bg-white'
      } ${!hidden && red ? 'text-red-600' : !hidden ? 'text-black' : ''}`}
    >
      {hidden || !card ? '?' : `${card.rank}${card.suit}`}
    </div>
  )
}

function HandView({ title, hand, hideHole }: { title: string; hand: Hand; hideHole?: boolean }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        {title} {!hideHole && `(${hand.value})`}
      </p>
      <div className="flex flex-wrap gap-2">
        {hand.cards.map((c, i) => (
          <CardFace key={i} card={c} />
        ))}
        {/* When the hole card is hidden the dealer hand has only the up-card. */}
        {hideHole && <CardFace hidden />}
      </div>
    </div>
  )
}

export default function Blackjack() {
  const { busy, error, setError, history, run } = useGame({ game: 'BLACKJACK' })
  const [stake, setStake] = useState('1.00')
  const [game, setGame] = useState<BlackjackState | null>(null)

  const inRound = game?.status === 'PLAYER_TURN'

  const deal = async () => {
    const stakeMinor = Math.round(parseFloat(stake || '0') * 100)
    if (!Number.isFinite(stakeMinor) || stakeMinor <= 0) return setError('Enter a positive stake')
    const res = await run<BlackjackState>(() => gameService.blackjackDeal(stakeMinor))
    if (res) setGame(res)
  }

  const act = async (move: 'hit' | 'stand') => {
    if (!game) return
    const res = await run<BlackjackState>(() =>
      move === 'hit' ? gameService.blackjackHit(game.betId) : gameService.blackjackStand(game.betId),
    )
    if (res) setGame(res)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🃏 Blackjack</CardTitle>
          <p className="text-sm text-muted-foreground">Dealer stands on 17 · blackjack pays 3:2</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {game ? (
            <div className="space-y-6 rounded-lg border border-gold/20 bg-green-950/30 p-4 sm:p-6">
              <HandView title="Dealer" hand={game.dealer} hideHole={inRound} />
              <HandView title="You" hand={game.player} />
              {!inRound && game.status !== 'DEALER_TURN' && (
                <p className="text-center text-lg font-bold text-gold">
                  {statusLabel(game.status)} · {formatCurrency(game.payout)}
                </p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">Place a bet to start.</p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {inRound ? (
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => act('hit')}>
                Hit
              </Button>
              <Button variant="royal" className="flex-1" disabled={busy} onClick={() => act('stand')}>
                Stand
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Stake (USD)</label>
                <Input type="number" min="0.10" step="0.10" value={stake} onChange={(e) => setStake(e.target.value)} />
              </div>
              <Button size="lg" disabled={busy} onClick={deal}>
                Deal
              </Button>
            </div>
          )}

          <BetHistory history={history} />
        </CardContent>
      </Card>
    </div>
  )
}
