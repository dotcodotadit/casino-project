import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Maximize2, Minimize2, Loader2 } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { formatCurrency } from '@/lib/utils'
import type { LaunchResult } from '@/types/aggregator.types'

interface GameLauncherProps {
  launch: LaunchResult
  onClose: () => void
}

/**
 * Full-screen game container. Renders the provider's launch URL in a sandboxed
 * iframe and overlays our own chrome (back button, live balance, fullscreen).
 * Money is handled server-side via callbacks; the header balance updates live
 * from the wallet store (socket `balance:update`).
 */
export function GameLauncher({ launch, onClose }: GameLauncherProps) {
  const wallet = useWalletStore((s) => s.wallet)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    const onFsChange = () => setIsFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    else await containerRef.current?.requestFullscreen().catch(() => {})
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Chrome */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Lobby
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">{launch.gameName}</p>
          <p className="text-[11px] text-muted-foreground">{launch.provider}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gold/30 bg-background px-3 py-1 font-mono text-sm font-semibold text-gold">
            {wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title={isFs ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Game frame */}
      <div className="relative flex-1">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
            <p className="text-sm">Loading {launch.gameName}…</p>
          </div>
        )}
        <iframe
          title={launch.gameName}
          src={launch.launchUrl}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
          // Sandbox the third-party game; allow what real provider iframes need.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-orientation-lock"
          allow="autoplay; fullscreen; payment"
        />
      </div>
    </div>
  )
}
