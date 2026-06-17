import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Gamepad2,
  Wallet,
  LifeBuoy,
  ShieldCheck,
  KeyRound,
  LogOut,
  Menu,
  Crown,
  Plug,
  Joystick,
  Activity,
  ArrowLeftRight,
  Webhook,
  Gift,
  FileBarChart,
  Target,
  ShoppingBag,
} from 'lucide-react'
import { useAdminAuthStore } from '@/store/useAdminAuthStore'
import { Toaster } from '@/components/Toaster'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/fairness', label: 'Fairness', icon: ShieldCheck },
  { to: '/seeds', label: 'Server Seeds', icon: KeyRound },
  // ── Aggregator ──
  { to: '/providers', label: 'Providers', icon: Plug },
  { to: '/provider-games', label: 'Provider Games', icon: Joystick },
  { to: '/sessions', label: 'Sessions', icon: Activity },
  { to: '/provider-transactions', label: 'Provider Tx', icon: ArrowLeftRight },
  { to: '/callbacks', label: 'Callbacks', icon: Webhook },
  // ── Bonus & Promotions ──
  { to: '/bonuses', label: 'Bonuses', icon: Gift },
  { to: '/bonus-report', label: 'Bonus Report', icon: FileBarChart },
  // ── Loyalty & VIP ──
  { to: '/vip', label: 'VIP Levels', icon: Crown },
  { to: '/missions', label: 'Missions', icon: Target },
  { to: '/loyalty-shop', label: 'Loyalty Shop', icon: ShoppingBag },
]

export default function AdminLayout() {
  const { session, logout } = useAdminAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Crown className="h-6 w-6 text-gold" />
          <span className="font-bold">
            Royal <span className="text-gold-gradient">Admin</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="text-sm text-muted-foreground lg:hidden">
            Admin
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{session?.username}</p>
              <p className="text-xs text-muted-foreground">{session?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  )
}
