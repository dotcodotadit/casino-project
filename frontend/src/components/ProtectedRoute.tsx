import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoadingScreen } from '@/components/feedback/Spinner'
import type { ReactNode } from 'react'

/** Gate routes behind authentication. Redirects to /login preserving the target. */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuthStore()
  const location = useLocation()

  // Wait for the boot-time session restore before deciding.
  if (!initialized) {
    return (
      <div className="min-h-screen">
        <LoadingScreen label="Restoring your session…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
