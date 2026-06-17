import { NavLink } from 'react-router-dom'
import { LayoutGrid, Sparkles, Joystick } from 'lucide-react'
import { gameNav } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Desktop games sidebar. */
export function GamesSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-border p-4 lg:block">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
      >
        <LayoutGrid className="h-4 w-4" /> Lobby
      </NavLink>
      <NavLink
        to="/games"
        className={({ isActive }) =>
          cn(
            'mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
      >
        <Joystick className="h-4 w-4" /> Game Library
      </NavLink>

      <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In-house</p>
      <nav className="flex flex-col gap-1">
        {gameNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Provably Fair
        </p>
        <p className="mt-1">Every round is verifiable. Check the seed &amp; nonce after each bet.</p>
      </div>
    </aside>
  )
}
