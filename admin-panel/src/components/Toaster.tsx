import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useToast } from '@/store/useToast'
import { cn } from '@/lib/utils'

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const styles = {
  success: 'border-success/40 text-success',
  error: 'border-destructive/40 text-destructive',
  info: 'border-border text-foreground',
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.variant]
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn('admin-card flex items-center gap-2 px-4 py-3 text-sm shadow-lg', styles[t.variant])}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-foreground">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
