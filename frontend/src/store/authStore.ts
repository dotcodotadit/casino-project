import { create } from 'zustand'
import { setAccessToken, setUnauthorizedHandler, setTokenRefreshHandler } from '@/lib/api'
import { authService } from '@/services/auth.service'
import { useWalletStore } from '@/store/walletStore'
import type { User, RegisterInput } from '@/types/user.types'

/** Clear all per-user client state. Prevents cross-user data leakage on shared devices. */
function clearUserState() {
  setAccessToken(null)
  useWalletStore.getState().reset()
  useWalletStore.persist.clearStorage()
}

interface AuthState {
  user: User | null
  accessToken: string | null
  loading: boolean
  initialized: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  /** Restore a session via the httpOnly refresh cookie on app boot. */
  bootstrap: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  loading: false,
  initialized: false,

  setUser: (user) => set({ user }),

  login: async (identifier, password) => {
    set({ loading: true })
    try {
      const { user, tokens } = await authService.login(identifier, password)
      setAccessToken(tokens.accessToken)
      set({ user, accessToken: tokens.accessToken })
    } finally {
      set({ loading: false })
    }
  },

  register: async (input) => {
    set({ loading: true })
    try {
      const { user, tokens } = await authService.register(input)
      setAccessToken(tokens.accessToken)
      set({ user, accessToken: tokens.accessToken })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    try {
      await authService.logout()
    } finally {
      clearUserState()
      set({ user: null, accessToken: null })
    }
  },

  bootstrap: async () => {
    try {
      const { user, tokens } = await authService.refresh()
      setAccessToken(tokens.accessToken)
      set({ user, accessToken: tokens.accessToken })
    } catch {
      set({ user: null, accessToken: null })
    } finally {
      set({ initialized: true })
    }
  },
}))

// Re-export under the prompt's preferred name.
export const useAuth = useAuthStore

// Wire the api 401 handler back into the store once.
setUnauthorizedHandler(() => {
  clearUserState()
  useAuthStore.setState({ user: null, accessToken: null })
})

// When the api layer silently refreshes the access token, propagate it into the
// store so token-dependent effects (e.g. the socket connection) re-run.
setTokenRefreshHandler((token) => {
  useAuthStore.setState({ accessToken: token })
})
