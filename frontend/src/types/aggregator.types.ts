// Aggregator (third-party games) types — mirror the backend DTOs.

export type ProviderCode = 'PGSOFT' | 'PRAGMATIC' | 'EVOLUTION' | 'JILI'
export type GameCategory = 'SLOTS' | 'LIVE' | 'TABLE' | 'CRASH' | 'FISHING' | 'LOTTERY' | 'OTHER'

export interface AggregatorProvider {
  code: ProviderCode
  name: string
  status: 'ACTIVE' | 'DISABLED' | 'MAINTENANCE'
}

export interface LobbyGame {
  id: string
  externalId: string
  name: string
  category: GameCategory
  rtp: number | null
  maintenance: boolean
  thumbnailUrl: string | null
  provider: { code: ProviderCode; name: string }
}

export interface PaginatedGames {
  items: LobbyGame[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface LaunchResult {
  sessionId: string
  token: string
  launchUrl: string
  gameName: string
  provider: ProviderCode
}

export interface GameFilters {
  provider?: ProviderCode
  category?: GameCategory
  q?: string
  page: number
}
