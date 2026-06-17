import {
  Percent,
  TrendingUp,
  Banknote,
  Clock,
  Gem,
  UserCheck,
  Gift,
  RefreshCw,
  Star,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { formatCurrency } from '@/lib/utils'
import type { VipBenefit } from '@/types/loyalty.types'

const ICONS: Record<string, LucideIcon> = {
  CASHBACK_PCT: Percent,
  BONUS_BOOST_PCT: TrendingUp,
  WITHDRAWAL_LIMIT: Banknote,
  WITHDRAWAL_SPEED: Clock,
  POINT_MULTIPLIER: Gem,
  DEDICATED_MANAGER: UserCheck,
  BIRTHDAY_GIFT: Gift,
  FREE_WITHDRAWALS: RefreshCw,
  CUSTOM: Star,
}

/** Human-readable value per benefit type. */
function formatBenefit(b: VipBenefit): string {
  switch (b.type) {
    case 'CASHBACK_PCT':
    case 'BONUS_BOOST_PCT':
      return `${b.value}%`
    case 'POINT_MULTIPLIER':
      return `${b.value}×`
    case 'WITHDRAWAL_LIMIT':
      return b.valueMinor != null ? `${formatCurrency(b.valueMinor)} / day` : `${b.value}`
    case 'WITHDRAWAL_SPEED':
      return `${b.value}h`
    case 'BIRTHDAY_GIFT':
      return b.valueMinor != null ? formatCurrency(b.valueMinor) : `${b.value}`
    case 'FREE_WITHDRAWALS':
      return `${b.value} / week`
    case 'DEDICATED_MANAGER':
      return b.value ? 'Included' : '—'
    default:
      return b.unit ? `${b.value} ${b.unit}` : `${b.value}`
  }
}

/**
 * Grid of the player's current-tier benefits. Reads resolved benefits from the
 * loyalty store (server-side resolved + Redis cached).
 */
export default function VipBenefits() {
  const benefits = useLoyaltyStore((s) => s.benefits)

  if (benefits.length === 0) {
    return <p className="text-sm text-muted-foreground">No benefits configured for your tier yet.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {benefits.map((b) => {
        const Icon = ICONS[b.type] ?? Star
        return (
          <div key={b.key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15">
              <Icon className="h-5 w-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.name}</p>
              <p className="text-sm font-bold text-gold-gradient">{formatBenefit(b)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
