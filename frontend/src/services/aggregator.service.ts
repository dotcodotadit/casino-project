import { api } from '@/lib/api'
import type { AggregatorProvider, PaginatedGames, LaunchResult, GameFilters, ProviderCode } from '@/types/aggregator.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Aggregator API client. Talks to /api/aggregator (via the gateway). The launch
 * flow returns a provider URL we render in an iframe; all bet/win money movement
 * happens server-to-server through the callback endpoint, not from the browser.
 */
export const aggregatorService = {
  async getProviders(): Promise<AggregatorProvider[]> {
    const { data } = await api.get<Envelope<AggregatorProvider[]>>('/aggregator/providers')
    return data.data
  },

  async getGames(filters: GameFilters): Promise<PaginatedGames> {
    const params = new URLSearchParams()
    if (filters.provider) params.set('provider', filters.provider)
    if (filters.category) params.set('category', filters.category)
    if (filters.q) params.set('q', filters.q)
    params.set('page', String(filters.page))
    params.set('pageSize', '24')
    const { data } = await api.get<Envelope<PaginatedGames>>(`/aggregator/games?${params}`)
    return data.data
  },

  async launch(provider: ProviderCode, gameId: string, currency = 'USD'): Promise<LaunchResult> {
    const { data } = await api.post<Envelope<LaunchResult>>('/aggregator/launch', { provider, gameId, currency })
    return data.data
  },

  async getBalance(): Promise<{ balanceMinor: number; balance: number; currency: string }> {
    const { data } = await api.get<Envelope<{ balanceMinor: number; balance: number; currency: string }>>('/aggregator/balance')
    return data.data
  },
}
