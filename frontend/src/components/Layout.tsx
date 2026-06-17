import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Coins, Wallet as WalletIcon, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useSocket } from '@/hooks/useSocket'
import { GamesSidebar } from '@/components/GamesSidebar'
import { MobileNav } from '@/components/MobileNav'
import { UserMenu } from '@/components/UserMenu'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { Toaster } from '@/components/Toaster'
import { gameNav } from '@/lib/nav'
import { cn, formatCurrency } from '@/lib/utils'

const topNav = [
  { to: '/', label: 'Lobby', end: true },
  { to: '/games', label: 'Library', end: false },
  { to: '/casino', label: 'Casino', end: false },
  { to: '/vip', label: 'VIP', end: false },
  { to: '/missions', label: 'Missions', end: false },
  ...gameNav.map((g) => ({ to: g.to, label: g.label, end: false })),
]

export default function Layout() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const { wallet, fetchWallet } = useWalletStore()

  // Connect the authenticated socket; balance + notifications pipe into stores.
  useSocket()

  useEffect(() => {
    if (!accessToken) return
    void fetchWallet()
  }, [accessToken, fetchWallet])

  return (
    <div className="min-h-screen pb-16 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-lg font-black">
              <Coins className="h-6 w-6 text-gold" />
              <span className="text-gold-gradient hidden sm:inline">Royal Casino</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {topNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Balance pill → quick deposit */}
            <Link
              to="/wallet"
              className="flex items-center gap-2 rounded-full border border-gold/30 bg-card py-1.5 pl-3 pr-1.5 transition-colors hover:border-gold/60"
            >
              <WalletIcon className="h-4 w-4 text-gold" />
              <span className="font-mono text-sm font-semibold text-gold">
                {wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-black">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </Link>

            <ThemeSwitcher />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Body: games sidebar + content */}
      <div className="flex">
        <GamesSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="hidden border-t border-border py-6 text-center text-xs text-muted-foreground lg:block">
        Royal Casino — demo / educational build. No real money. Provably-fair simulation.
      </footer>

      <MobileNav />
      <Toaster />
    </div>
  )
}
