import { Link } from 'react-router-dom'
import { Dice5, CircleDot, Spade } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'

const games = [
  { to: '/games/slots', name: 'Slot Machine', desc: '5-reel · free spins · bonus', Icon: Dice5, glow: 'shadow-gold' },
  { to: '/games/roulette', name: 'Roulette', desc: 'European & American', Icon: CircleDot, glow: 'shadow-royal' },
  { to: '/games/blackjack', name: 'Blackjack', desc: 'Beat the dealer to 21', Icon: Spade, glow: 'shadow-gold' },
]

export default function LobbyPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gold/20 bg-gradient-to-r from-royal-dark/40 to-transparent p-8">
        <h1 className="text-3xl font-black md:text-4xl">
          Welcome back, <span className="text-gold-gradient">{user?.username}</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Pick a game below. Every round is provably fair — verify the seed + nonce after each bet.
        </p>
        {user?.kycLevel !== 'FULL' && (
          <Link to="/kyc" className="mt-4 inline-block text-sm text-gold hover:underline">
            Complete KYC to unlock withdrawals →
          </Link>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map(({ to, name, desc, Icon, glow }) => (
          <Link key={to} to={to}>
            <Card className={`group transition-all hover:-translate-y-1 hover:${glow}`}>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Icon className="h-12 w-12 text-gold transition-transform group-hover:scale-110" />
                <h3 className="text-xl font-bold">{name}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
