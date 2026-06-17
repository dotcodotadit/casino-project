import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-black text-gold-gradient">404</h1>
      <p className="text-muted-foreground">This table doesn’t exist.</p>
      <Button asChild>
        <Link to="/">Back to lobby</Link>
      </Button>
    </div>
  )
}
