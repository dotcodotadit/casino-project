import axios, { AxiosError, type AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/**
 * Central axios instance.
 * - Attaches the access token from the auth store on every request.
 * - On 401, attempts a single refresh, then retries the original request.
 */
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
})

let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null
let onTokenRefreshed: ((token: string) => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

/** Notified when a background refresh produces a new access token. */
export function setTokenRefreshHandler(handler: (token: string) => void): void {
  onTokenRefreshed = handler
}

// Endpoints that must NOT trigger the 401 refresh-and-retry loop (the refresh
// call itself, and login — a 401 there is a real auth failure, not an expiry).
function isAuthFlow(url?: string): boolean {
  return !!url && (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/register'))
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Server envelope: { success, data: { user, tokens: { accessToken } } }
    const { data } = await axios.post<{ data: { tokens: { accessToken: string } } }>(
      `${BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    accessToken = data.data.tokens.accessToken
    // Propagate to the store so token-dependent effects (socket) re-run.
    onTokenRefreshed?.(accessToken)
    return accessToken
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      original &&
      !(original as any)._retry &&
      !isAuthFlow(original.url)
    ) {
      ;(original as any)._retry = true
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const newToken = await refreshing
      if (newToken) {
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)
