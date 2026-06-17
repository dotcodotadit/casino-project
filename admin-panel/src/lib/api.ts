import axios, { type AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/**
 * Admin axios instance. Talks to the same gateway as the player app but with an
 * admin access token. Real admin endpoints (/api/admin/*) are a backend follow-up;
 * the service layer currently resolves from rich demo fixtures (see mock-data.ts)
 * and is structured so swapping to live endpoints is a one-line change per call.
 */
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})
