import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User as UserIcon, Wallet, ShieldCheck, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'

const kycVariant = { FULL: 'success', BASIC: 'warning', NONE: 'outline' } as const

export function UserMenu() {
  const { user, logout } = useAuthStore()
  const wallet = useWalletStore((s) => s.wallet)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  if (!user) return null

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden text-sm font-medium sm:inline">{user.username}</span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl animate-in fade-in zoom-in-95">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 font-bold text-gold">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{user.username}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Balance</span>
              <span className="font-mono text-sm font-semibold text-gold">
                {wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">KYC</span>
              <Badge variant={kycVariant[user.kycLevel] ?? 'outline'}>{user.kycLevel}</Badge>
            </div>
          </div>

          <nav className="p-1">
            {[
              { to: '/wallet', label: 'Wallet', icon: Wallet },
              { to: '/kyc', label: 'Verification', icon: ShieldCheck },
              { to: '/', label: 'My Account', icon: UserIcon },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10',
              )}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
