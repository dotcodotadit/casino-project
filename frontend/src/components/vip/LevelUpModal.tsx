import { createPortal } from 'react-dom'
import { Crown, X } from 'lucide-react'
import { useLoyaltyStore } from '@/store/useLoyaltyStore'
import { Button } from '@/components/ui/button'

/**
 * Celebratory level-up modal. Driven by `levelUpEvent` in the loyalty store,
 * which is set when a `vip:levelup` socket event arrives. Cleared on dismiss.
 */
export default function LevelUpModal() {
  const event = useLoyaltyStore((s) => s.levelUpEvent)
  const clear = useLoyaltyStore((s) => s.clearLevelUp)
  if (!event) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={clear}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-royal-dark to-card p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={clear} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold/15">
          <Crown className="h-10 w-10 text-gold" />
        </div>
        <p className="text-sm uppercase tracking-widest text-gold">Level Up!</p>
        <h2 className="mt-1 text-3xl font-bold text-gold-gradient">{event.levelName}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You advanced from level {event.fromLevel} to <span className="font-semibold text-foreground">level {event.toLevel}</span>.
          Enjoy your new VIP benefits!
        </p>
        <Button className="mt-6 w-full" onClick={clear}>
          Awesome
        </Button>
      </div>
    </div>,
    document.body,
  )
}
