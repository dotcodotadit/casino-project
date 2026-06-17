import { useEffect, useState } from 'react'
import { Gift, Lock, Sparkles } from 'lucide-react'
import { useBonusStore } from '@/store/useBonusStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { AvailableBonus } from '@/types/bonus.types'
import BonusModal from './BonusModal'

/**
 * Grid of claimable bonuses. Eligible bonuses show a Claim button; locked ones
 * explain why. Code-claim bonuses open the modal for promo-code entry.
 */
export default function AvailableBonuses() {
  const available = useBonusStore((s) => s.available)
  const loading = useBonusStore((s) => s.loading)
  const claiming = useBonusStore((s) => s.claiming)
  const claim = useBonusStore((s) => s.claim)
  const fetchAll = useBonusStore((s) => s.fetchAll)
  const [selected, setSelected] = useState<AvailableBonus | null>(null)

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  if (loading && available.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading bonuses…</p>
  }
  if (available.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <Gift className="mx-auto mb-2 h-8 w-8 opacity-50" />
        No bonuses available right now. Check back soon!
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((b) => (
          <BonusCard
            key={b.id}
            bonus={b}
            busy={claiming === b.id}
            onClaim={() => {
              if (b.requiresCode) setSelected(b)
              else void claim({ bonusId: b.id })
            }}
            onDetails={() => setSelected(b)}
          />
        ))}
      </div>
      {selected && <BonusModal bonus={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function BonusCard({
  bonus,
  busy,
  onClaim,
  onDetails,
}: {
  bonus: AvailableBonus
  busy: boolean
  onClaim: () => void
  onDetails: () => void
}) {
  const reward =
    bonus.rewardType === 'PERCENTAGE'
      ? `${Math.round((bonus.percentage ?? 0) * 100)}% match`
      : bonus.rewardType === 'FREE_SPINS'
        ? `${bonus.freeSpins} free spins`
        : bonus.maxAmount
          ? `${formatCurrency(bonus.maxAmount)} bonus`
          : 'Bonus'

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h3 className="font-bold">{bonus.name}</h3>
        </div>
        <Badge variant="gold">{bonus.kind}</Badge>
      </div>

      <p className="mb-3 line-clamp-2 flex-1 text-sm text-muted-foreground">
        {bonus.description ?? reward}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Badge variant="outline">{reward}</Badge>
        {bonus.wagerMultiplier > 0 && <Badge variant="outline">{bonus.wagerMultiplier}× wager</Badge>}
        {bonus.minDeposit != null && (
          <Badge variant="outline">min {formatCurrency(bonus.minDeposit)}</Badge>
        )}
      </div>

      {bonus.eligible ? (
        <Button size="sm" disabled={busy} onClick={onClaim}>
          {busy ? 'Claiming…' : bonus.requiresCode ? 'Enter code' : 'Claim'}
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" onClick={onDetails}>
            <Lock className="h-3.5 w-3.5" /> Locked
          </Button>
          {bonus.reasons[0] && (
            <p className="text-center text-xs text-muted-foreground">{bonus.reasons[0]}</p>
          )}
        </div>
      )}
    </div>
  )
}
