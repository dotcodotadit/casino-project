import { useEffect, useState } from 'react'
import { Gamepad2, Wrench, Trophy } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/store/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { GameConfig } from '@/types/admin.types'

export default function Games() {
  const [games, setGames] = useState<GameConfig[]>([])
  const push = useToast((s) => s.push)

  useEffect(() => {
    adminService.listGames().then(setGames)
  }, [])

  const update = async (id: string, patch: Partial<GameConfig>, note: string) => {
    const g = await adminService.updateGame(id, patch)
    setGames((prev) => prev.map((x) => (x.id === id ? g : x)))
    push(note, 'success')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game Management</h1>
        <p className="text-sm text-muted-foreground">RTP, maintenance mode &amp; jackpot configuration</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <GameCard key={g.id} game={g} onUpdate={update} />
        ))}
      </div>
    </div>
  )
}

function GameCard({
  game,
  onUpdate,
}: {
  game: GameConfig
  onUpdate: (id: string, patch: Partial<GameConfig>, note: string) => void
}) {
  const [rtp, setRtp] = useState((game.rtp * 100).toFixed(2))
  const [jackpot, setJackpot] = useState((game.jackpotMinor / 100).toFixed(2))

  const saveRtp = () => {
    const v = parseFloat(rtp) / 100
    if (!Number.isFinite(v) || v <= 0 || v > 1.2) return
    onUpdate(game.id, { rtp: v }, `${game.displayName} RTP set to ${formatPercent(v)}`)
  }
  const saveJackpot = () => {
    const minor = Math.round(parseFloat(jackpot || '0') * 100)
    onUpdate(game.id, { jackpotMinor: minor }, `${game.displayName} jackpot set to ${formatCurrency(minor)}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-gold" /> {game.displayName}
          </CardTitle>
          {game.maintenance ? <Badge variant="warning">Maintenance</Badge> : game.enabled ? <Badge variant="success">Live</Badge> : <Badge variant="outline">Disabled</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{game.game}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RTP */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">RTP (%) · house edge {formatPercent(1 - game.rtp)}</label>
          <div className="flex gap-2">
            <Input type="number" min="50" max="120" step="0.1" value={rtp} onChange={(e) => setRtp(e.target.value)} />
            <Button variant="outline" onClick={saveRtp}>Save</Button>
          </div>
        </div>

        {/* Jackpot */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="h-3 w-3" /> Jackpot (USD)
          </label>
          <div className="flex gap-2">
            <Input type="number" min="0" step="1" value={jackpot} onChange={(e) => setJackpot(e.target.value)} disabled={!game.jackpotEnabled} />
            <Button variant="outline" onClick={saveJackpot} disabled={!game.jackpotEnabled}>Save</Button>
          </div>
          <button
            className="mt-1 text-xs text-royal-light hover:underline"
            onClick={() => onUpdate(game.id, { jackpotEnabled: !game.jackpotEnabled }, `Jackpot ${!game.jackpotEnabled ? 'enabled' : 'disabled'} for ${game.displayName}`)}
          >
            {game.jackpotEnabled ? 'Disable jackpot' : 'Enable jackpot'}
          </button>
        </div>

        {/* Bet limits */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Min bet {formatCurrency(game.minBetMinor)}</span>
          <span>Max bet {formatCurrency(game.maxBetMinor)}</span>
        </div>

        {/* Toggles */}
        <div className="flex gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant={game.maintenance ? 'secondary' : 'outline'}
            className="flex-1"
            onClick={() => onUpdate(game.id, { maintenance: !game.maintenance }, `${game.displayName} maintenance ${!game.maintenance ? 'ON' : 'OFF'}`)}
          >
            <Wrench className="h-3.5 w-3.5" /> {game.maintenance ? 'End maintenance' : 'Maintenance'}
          </Button>
          <Button
            size="sm"
            variant={game.enabled ? 'destructive' : 'success'}
            className="flex-1"
            onClick={() => onUpdate(game.id, { enabled: !game.enabled }, `${game.displayName} ${!game.enabled ? 'enabled' : 'disabled'}`)}
          >
            {game.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
