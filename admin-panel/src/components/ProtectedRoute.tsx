import { Navigate } from 'react-router-dom'
import { useAdminAuthStore } from '@/store/useAdminAuthStore'

/** Gate admin routes behind a session. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useAdminAuthStore((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
