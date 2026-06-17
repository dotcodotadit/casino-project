import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { useThemeStore, THEMES } from '@/store/useThemeStore'
import { useClickOutside } from '@/hooks/useClickOutside'

export function ThemeSwitcher() {
  const { accent, setAccent } = useThemeStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Theme"
      >
        <Palette className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl animate-in fade-in zoom-in-95">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Theme</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setAccent(t.id)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20" style={{ background: t.swatch }} />
                {t.label}
              </span>
              {accent === t.id && <Check className="h-4 w-4 text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
