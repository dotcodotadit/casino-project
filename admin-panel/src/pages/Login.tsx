import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { useAdminAuthStore } from '@/store/useAdminAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function Login() {
  const { login, error } = useAdminAuthStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await login(username, password)
    setBusy(false)
    if (ok) navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Crown className="h-10 w-10 text-gold" />
          <h1 className="text-xl font-bold">
            Royal <span className="text-gold-gradient">Admin</span>
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to the control panel</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Demo credentials: admin / admin123</p>
        </form>
      </Card>
    </div>
  )
}
