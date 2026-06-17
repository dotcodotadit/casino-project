import { useState, useEffect } from 'react'
import { Crown, ShoppingBag, Coins } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import VipDashboard from '@/components/vip/VipDashboard'
import VipShop from '@/components/vip/VipShop'
import LevelUpModal from '@/components/vip/LevelUpModal'
import { cn } from '@/lib/utils'

type Tab = 'dashboard' | 'shop' | 'history'

/**
 * VIP hub page — tabbed: tier dashboard, loyalty shop, redemption history.
 * LevelUpModal is mounted here so a celebration shows whenever a level-up event
 * arrives while the player is on this page (it is also harmless elsewhere).
 */
export default function VipPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const redemptions = useLoyaltyStore((s) => s.redemptions)
  const fetchShop = useLoyaltyStore((s) => s.fetchShop)

  useEffect(() => {
    void fetchShop()
  }, [fetchShop])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Crown className="h-6 w-6 text-gold" /> VIP Club
        </h1>
        <p className="text-sm text-muted-foreground">Climb the tiers, unlock perks, and redeem rewards.</p>
      </header>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={Crown}>
          Dashboard
        </TabButton>
        <TabButton active={tab === 'shop'} onClick={() => setTab('shop')} icon={ShoppingBag}>
          Shop
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={Coins}>
          History
        </TabButton>
      </div>

      {tab === 'dashboard' && <VipDashboard />}
      {tab === 'shop' && <VipShop />}
      {tab === 'history' && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Cost</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                redemptions.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">{r.item}</td>
                    <td className="px-4 py-2">{r.costPoints.toLocaleString()} pts</td>
                    <td className="px-4 py-2">{r.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <LevelUpModal />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Crown
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}
