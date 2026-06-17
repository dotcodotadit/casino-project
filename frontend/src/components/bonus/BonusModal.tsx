import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, AlertCircle } from 'lucide-react'
import { useBonusStore } from '@/store/useBonusStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { AvailableBonus } from '@/types/bonus.types'

/**
 * Bonus detail + claim modal. Shows full terms (reward, wagering, eligibility)
 * and a claim action. For CODE bonuses it collects a promo code; for locked
 * bonuses it explains every failing requirement.
 */
export default function BonusModal({
  bonus,
  onClose,
}: {
  bonus: AvailableBonus
  onClose: () => void
}) {
  const claim = useBonusStore((s) => s.claim)
  const claiming = useBonusStore((s) => s.claiming)
  const [code, setCode] = useState('')

  const busy = claiming === bonus.id || claiming === 'code'

  const handleClaim = async () => {
    const ok = await claim(bonus.requiresCode ? { code } : { bonusId: bonus.id })
    if (ok) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-gold" />
            <h2 className="text-xl font-bold text-gold-gradient">{bonus.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {bonus.description && <p className="mb-4 text-sm text-muted-foreground">{bonus.description}</p>}

        <dl className="mb-4 space-y-2 text-sm">
          <Row label="Type"><Badge variant="gold">{bonus.kind}</Badge></Row>
          {bonus.rewardType === 'PERCENTAGE' && (
            <Row label="Match">{Math.round((bonus.percentage ?? 0) * 100)}%</Row>
          )}
          {bonus.maxAmount != null && <Row label="Max bonus">{formatCurrency(bonus.maxAmount)}</Row>}
          {bonus.minDeposit != null && <Row label="Min deposit">{formatCurrency(bonus.minDeposit)}</Row>}
          {bonus.freeSpins > 0 && <Row label="Free spins">{bonus.freeSpins}</Row>}
          <Row label="Wagering">{bonus.wagerMultiplier > 0 ? `${bonus.wagerMultiplier}×` : 'None'}</Row>
        </dl>

        {!bonus.eligible && bonus.reasons.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-amber-400">
              <AlertCircle className="h-4 w-4" /> Requirements
            </div>
            <ul className="list-inside list-disc text-xs text-amber-200/80">
              {bonus.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {bonus.requiresCode && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PROMO CODE"
            className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase tracking-wider outline-none focus:border-gold"
          />
        )}

        <Button
          className="w-full"
          disabled={busy || (!bonus.eligible && !bonus.requiresCode) || (bonus.requiresCode && code.length === 0)}
          onClick={handleClaim}
        >
          {busy ? 'Claiming…' : bonus.requiresCode ? 'Redeem code' : 'Claim bonus'}
        </Button>
      </div>
    </div>,
    document.body,
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
