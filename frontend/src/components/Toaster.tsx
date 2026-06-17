import { CheckCircle2, Info, XCircle, Trophy } from 'lucide-react'
import { useNotifications, type NotifVariant } from '@/store/useNotifications'
import { cn } from '@/lib/utils'

const icons: Record<NotifVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  win: Trophy,
}
const accents: Record<NotifVariant, string> = {
  success: 'border-emerald-500/40',
  error: 'border-destructive/40',
  info: 'border-border',
  win: 'border-gold/50',
}
const iconColor: Record<NotifVariant, string> = {
  success: 'text-emerald-400',
  error: 'text-destructive',
  info: 'text-muted-foreground',
  win: 'text-gold',
}

export function Toaster() {
  const { toasts, dismissToast } = useNotifications()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.variant]
        return (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={cn(
              'casino-card pointer-events-auto flex items-start gap-3 p-3 text-left shadow-lg animate-in slide-in-from-bottom-2',
              accents[t.variant],
            )}
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconColor[t.variant])} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.message && <p className="truncate text-xs text-muted-foreground">{t.message}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
