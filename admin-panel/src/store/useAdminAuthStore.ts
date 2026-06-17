import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAccessToken } from '@/lib/api'

interface AdminSession {
  username: string
  role: 'ADMIN' | 'SUPPORT'
}

interface AdminAuthState {
  session: AdminSession | null
  token: string | null
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

/**
 * Admin authentication.
 *
 * DEMO auth: validates against local demo credentials and issues a placeholder
 * token. In production this would POST /auth/login, assert the returned user's
 * role is ADMIN/SUPPORT, and store the real access token. The seam is here.
 */
const DEMO = { username: 'admin', password: 'admin123', role: 'ADMIN' as const }

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      session: null,
      token: null,
      error: null,
      login: async (username, password) => {
        if (username === DEMO.username && password === DEMO.password) {
          const token = `demo.admin.${btoa(username)}`
          setAccessToken(token)
          set({ session: { username, role: DEMO.role }, token, error: null })
          return true
        }
        set({ error: 'Invalid credentials (demo: admin / admin123)' })
        return false
      },
      logout: () => {
        setAccessToken(null)
        set({ session: null, token: null, error: null })
      },
    }),
    {
      name: 'casino-admin-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAccessToken(state.token)
      },
    },
  ),
)
