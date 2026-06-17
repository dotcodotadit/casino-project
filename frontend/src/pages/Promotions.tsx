import { useEffect } from 'react'
import { Gift, Sparkles, Trophy } from 'lucide-react'
import { useBonusStore } from '@/store/useBonusStore'
import AvailableBonuses from '@/components/bonus/AvailableBonuses'
import WageringProgress from '@/components/bonus/WageringProgress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

/**
 * Promotions hub. Surfaces marketing promotions, claimable bonuses, the player's
 * live wagering progress, free-spin packages, and bonus history — all driven by
 * the bonus store (which is kept live by socket events).
 */
export default function Promotions() {
  const promotions = useBonusStore((s) => s.promotions)
  const freeSpins = useBonusStore((s) => s.freeSpins)
  const history = useBonusStore((s) => s.history)
  const fetchPromotions = useBonusStore((s) => s.fetchPromotions)
  const fetchAll = useBonusStore((s) => s.fetchAll)

  useEffect(() => {
    void fetchPromotions()
    void fetchAll()
  }, [fetchPromotions, fetchAll])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gift className="h-6 w-6 text-gold" /> Promotions
        </h1>
        <p className="text-sm text-muted-foreground">Claim bonuses, track wagering, and grab free spins.</p>
      </header>

      {/* Featured promotions */}
      {promotions.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {promotions.map((p) => (
            <div
              key={p.id}
              className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-royal-dark/40 to-card p-6"
            >
              <Sparkles className="absolute right-4 top-4 h-8 w-8 text-gold/30" />
              <h2 className="text-xl font-bold text-gold-gradient">{p.title}</h2>
              {p.subtitle && <p className="mt-1 text-sm text-muted-foreground">{p.subtitle}</p>}
              {p.description && <p className="mt-3 text-sm">{p.description}</p>}
              {p.bonus && <Badge variant="gold" className="mt-3">{p.bonus.kind}</Badge>}
            </div>
          ))}
        </section>
      )}

      {/* Active wagering */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-gold" /> Active wagering
        </h2>
        <WageringProgress />
      </section>

      {/* Available bonuses */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Available bonuses</h2>
        <AvailableBonuses />
      </section>

      {/* Free spins */}
      {freeSpins.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Free spin packages</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {freeSpins.map((fs) => (
              <div key={fs.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{fs.gameId ?? 'Any eligible game'}</span>
                  <Badge variant={fs.status === 'ACTIVE' ? 'success' : 'outline'}>{fs.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {fs.remainingSpins}/{fs.totalSpins} spins left · {formatCurrency(fs.spinValue)} each
                </p>
                {fs.winnings > 0 && (
                  <p className="text-xs text-emerald-400">Won {formatCurrency(fs.winnings)}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Bonus history</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Bonus</th>
                  <th className="px-4 py-2">Granted</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-2">{b.name}</td>
                    <td className="px-4 py-2">{formatCurrency(b.grantedAmount)}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          b.status === 'COMPLETED' ? 'success' : b.status === 'EXPIRED' ? 'warning' : 'outline'
                        }
                      >
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
