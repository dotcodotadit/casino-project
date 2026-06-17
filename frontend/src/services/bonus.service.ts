import { api } from '@/lib/api'
import type {
  AvailableBonus,
  UserBonus,
  FreeSpinPackage,
  Promotion,
} from '@/types/bonus.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Bonus API client. Talks to /api/bonus (via the gateway). All money movement is
 * server-side; the client only reads state and issues claim/cancel intents.
 */
export const bonusService = {
  async available(): Promise<AvailableBonus[]> {
    const { data } = await api.get<Envelope<AvailableBonus[]>>('/bonus/available')
    return data.data
  },

  async mine(status?: string): Promise<UserBonus[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    const { data } = await api.get<Envelope<UserBonus[]>>(`/bonus/mine${qs}`)
    return data.data
  },

  async progress(): Promise<UserBonus[]> {
    const { data } = await api.get<Envelope<UserBonus[]>>('/bonus/progress')
    return data.data
  },

  async claim(input: { bonusId?: string; code?: string }): Promise<UserBonus> {
    const { data } = await api.post<Envelope<UserBonus>>('/bonus/claim', input)
    return data.data
  },

  async cancel(userBonusId: string): Promise<{ ok: boolean }> {
    const { data } = await api.post<Envelope<{ ok: boolean }>>(`/bonus/${userBonusId}/cancel`, {})
    return data.data
  },

  async freeSpins(): Promise<FreeSpinPackage[]> {
    const { data } = await api.get<Envelope<FreeSpinPackage[]>>('/bonus/free-spins')
    return data.data
  },

  async promotions(): Promise<Promotion[]> {
    const { data } = await api.get<Envelope<Promotion[]>>('/bonus/promotions')
    return data.data
  },
}
