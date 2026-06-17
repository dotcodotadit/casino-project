import { useEffect } from 'react'
import { ShoppingBag, Lock, Coins, Sparkles, Gift, Gamepad2, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ShopItem } from '@/types/loyalty.types'

const TYPE_ICON: Record<string, LucideIcon> = {
  FREE_SPINS: Sparkles,
  BONUS_MONEY: Coins,
  CASHBACK_BOOST: Gift,
  PHYSICAL: Package,
  CUSTOM: Gamepad2,
}

/**
 * VIP loyalty shop. Spend loyalty points on rewards; items can be tier-locked or
 * limited stock. Redemption + balance update flow through the loyalty store.
 */
export default function VipShop() {
  const shop = useLoyaltyStore((s) => s.shop)
  const progress = useLoyaltyStore((s) => s.progress)
  const redeeming = useLoyaltyStore((s) => s.redeeming)
  const redeem = useLoyaltyStore((s) => s.redeem)
  const fetchShop = useLoyaltyStore((s) => s.fetchShop)

  useEffect(() => {
    void fetchShop()
  }, [fetchShop])

  const balance = progress?.loyaltyPoints ?? 0

  if (shop.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-50" />
        The shop is empty right now.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-4 py-2">
        <Coins className="h-5 w-5 text-gold" />
        <span className="text-sm">Your balance:</span>
        <span className="font-bold text-gold-gradient">{balance.toLocaleString()} points</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shop.map((item) => (
          <ShopCard
            key={item.id}
            item={item}
            affordable={balance >= item.costPoints}
            busy={redeeming === item.id}
            onRedeem={() => redeem(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ShopCard({
  item,
  affordable,
  busy,
  onRedeem,
}: {
  item: ShopItem
  affordable: boolean
  busy: boolean
  onRedeem: () => void
}) {
  const Icon = TYPE_ICON[item.type] ?? Gift
  const disabled = item.locked || item.soldOut || !affordable || busy

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-4', item.locked && 'opacity-70')}>
      <div className="mb-2 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        {item.stock != null && (
          <Badge variant={item.soldOut ? 'destructive' : 'outline'}>
            {item.soldOut ? 'Sold out' : `${item.stock} left`}
          </Badge>
        )}
      </div>

      <h3 className="font-semibold">{item.name}</h3>
      {item.description && <p className="mb-3 flex-1 text-xs text-muted-foreground">{item.description}</p>}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="flex items-center gap-1 font-bold text-gold">
          <Coins className="h-4 w-4" /> {item.costPoints.toLocaleString()}
        </span>
        {item.locked ? (
          <Button size="sm" variant="outline" disabled>
            <Lock className="h-3.5 w-3.5" /> Lvl {item.minLevel}
          </Button>
        ) : (
          <Button size="sm" disabled={disabled} onClick={onRedeem}>
            {busy ? 'Redeeming…' : affordable ? 'Redeem' : 'Not enough'}
          </Button>
        )}
      </div>
    </div>
  )
}
