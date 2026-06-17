import { api } from '@/lib/api'
import type { VipLevel, VipBenefit, VipProgress, Mission, ShopItem, Redemption } from '@/types/loyalty.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Loyalty & VIP API client. Talks to /api/loyalty (via the gateway). Reads tier
 * progress, missions, shop; issues claim/redeem intents. All point/level math is
 * server-side.
 */
export const loyaltyService = {
  async vipLevels(): Promise<VipLevel[]> {
    const { data } = await api.get<Envelope<VipLevel[]>>('/loyalty/vip/levels')
    return data.data
  },

  async vipMe(): Promise<{ progress: VipProgress; benefits: VipBenefit[] }> {
    const { data } = await api.get<Envelope<{ progress: VipProgress; benefits: VipBenefit[] }>>('/loyalty/vip/me')
    return data.data
  },

  async missions(): Promise<Mission[]> {
    const { data } = await api.get<Envelope<Mission[]>>('/loyalty/missions')
    return data.data
  },

  async claimMission(id: string): Promise<{ rewardPoints: number }> {
    const { data } = await api.post<Envelope<{ rewardPoints: number }>>(`/loyalty/missions/${id}/claim`, {})
    return data.data
  },

  async shop(): Promise<ShopItem[]> {
    const { data } = await api.get<Envelope<ShopItem[]>>('/loyalty/shop')
    return data.data
  },

  async redeem(itemId: string): Promise<{ redemptionId: string; item: string; costPoints: number }> {
    const { data } = await api.post<Envelope<{ redemptionId: string; item: string; costPoints: number }>>(
      '/loyalty/shop/redeem',
      { itemId },
    )
    return data.data
  },

  async redemptions(): Promise<Redemption[]> {
    const { data } = await api.get<Envelope<Redemption[]>>('/loyalty/shop/redemptions')
    return data.data
  },
}
