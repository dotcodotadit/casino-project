import { api } from '@/lib/api'
import type {
  SlotsResult,
  RouletteResult,
  RouletteVariant,
  RouletteBetKind,
  BlackjackState,
  PaginatedBets,
  GameType,
  FairnessInfo,
} from '@/types/game.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Game API client. All money-moving game actions go through the backend, which
 * performs the bet atomically and emits real-time balance updates over the
 * socket. These calls return the authoritative post-bet state.
 */
export const gameService = {
  async spinSlots(stakeMinor: number): Promise<SlotsResult> {
    const { data } = await api.post<Envelope<SlotsResult>>('/games/slots/spin', { stake: stakeMinor })
    return data.data
  },

  async spinRoulette(input: {
    stakeMinor: number
    variant: RouletteVariant
    bet: { kind: RouletteBetKind; number?: number }
  }): Promise<RouletteResult> {
    const { data } = await api.post<Envelope<RouletteResult>>('/games/roulette/spin', {
      stake: input.stakeMinor,
      variant: input.variant,
      bet: input.bet,
    })
    return data.data
  },

  // ── Blackjack ──
  async blackjackDeal(stakeMinor: number): Promise<BlackjackState> {
    const { data } = await api.post<Envelope<BlackjackState>>('/games/blackjack/deal', { stake: stakeMinor })
    return data.data
  },
  async blackjackHit(betId: string): Promise<BlackjackState> {
    const { data } = await api.post<Envelope<BlackjackState>>('/games/blackjack/hit', { betId })
    return data.data
  },
  async blackjackStand(betId: string): Promise<BlackjackState> {
    const { data } = await api.post<Envelope<BlackjackState>>('/games/blackjack/stand', { betId })
    return data.data
  },

  // ── History + fairness ──
  async history(game?: GameType, page = 1, pageSize = 10): Promise<PaginatedBets> {
    const params = new URLSearchParams()
    if (game) params.set('game', game)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    const { data } = await api.get<Envelope<PaginatedBets>>(`/games/history?${params}`)
    return data.data
  },

  async fairness(): Promise<FairnessInfo> {
    const { data } = await api.get<Envelope<FairnessInfo>>('/games/fairness')
    return data.data
  },

  async rotateSeed(): Promise<{ revealed: { seed: string; seedHash: string } | null; newHash: string }> {
    const { data } = await api.post<Envelope<{ revealed: { seed: string; seedHash: string } | null; newHash: string }>>(
      '/games/fairness/rotate',
    )
    return data.data
  },
}
