import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** App-level error boundary so a render crash shows a recovery screen, not a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // In production this would report to an error tracker (Sentry, etc.).
    console.error('UI crash:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-bold text-gold-gradient">Royal Casino</h1>
          <p className="font-semibold">Oops — something broke.</p>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button onClick={() => window.location.assign('/')}>Back to lobby</Button>
        </div>
      )
    }
    return this.props.children
  }
}
