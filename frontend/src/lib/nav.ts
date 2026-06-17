import { Dice5, CircleDot, Spade, LayoutGrid, Wallet, Joystick, Gift, Crown, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Game routes — used by the games sidebar, the mobile nav, and the lobby. */
export const gameNav: NavItem[] = [
  { to: '/games/slots', label: 'Slots', icon: Dice5 },
  { to: '/games/roulette', label: 'Roulette', icon: CircleDot },
  { to: '/games/blackjack', label: 'Blackjack', icon: Spade },
]

/** Primary app routes for the mobile bottom bar. */
export const primaryNav: NavItem[] = [
  { to: '/', label: 'Lobby', icon: LayoutGrid, end: true },
  { to: '/games', label: 'Library', icon: Joystick },
  { to: '/vip', label: 'VIP', icon: Crown },
  { to: '/promotions', label: 'Promos', icon: Gift },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
]

/** Reusable "Game Library" link (third-party aggregator games). */
export const libraryNav: NavItem = { to: '/games', label: 'Game Library', icon: Joystick }
