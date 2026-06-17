import { api } from '@/lib/api'
import type {
  AdminVipLevel,
  AdminMission,
  AdminShopItem,
  LoyaltyAnalytics,
  PointConfig,
  MissionFormData,
  LevelFormData,
} from '@/types/loyalty.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Admin loyalty service. Hits the live backend (`/api/loyalty/admin/*`) with a
 * deterministic fixture fallback so the panel renders without a running backend
 * (matching the bonus/aggregator admin services). Mutations update fixtures
 * in-place in fallback mode.
 */
const DEFAULT_LEVELS: AdminVipLevel[] = [
  { id: 'l0', level: 0, name: 'Bronze', color: '#cd7f32', icon: null, requiredPoints: 0, keepPoints: 0, pointMultiplier: 1, cashbackPct: 0, weeklyBonus: 0 },
  { id: 'l1', level: 1, name: 'Silver', color: '#c0c0c0', icon: null, requiredPoints: 1000, keepPoints: 500, pointMultiplier: 1.1, cashbackPct: 3, weeklyBonus: 0 },
  { id: 'l2', level: 2, name: 'Gold', color: '#ffd700', icon: null, requiredPoints: 5000, keepPoints: 2500, pointMultiplier: 1.25, cashbackPct: 5, weeklyBonus: 1000 },
  { id: 'l3', level: 3, name: 'Platinum', color: '#e5e4e2', icon: null, requiredPoints: 20000, keepPoints: 10000, pointMultiplier: 1.5, cashbackPct: 7, weeklyBonus: 2500 },
  { id: 'l4', level: 4, name: 'Diamond', color: '#b9f2ff', icon: null, requiredPoints: 60000, keepPoints: 30000, pointMultiplier: 1.75, cashbackPct: 10, weeklyBonus: 5000 },
  { id: 'l5', level: 5, name: 'Elite', color: '#9b59b6', icon: null, requiredPoints: 150000, keepPoints: 80000, pointMultiplier: 2, cashbackPct: 12, weeklyBonus: 10000 },
  { id: 'l6', level: 6, name: 'Legend', color: '#e74c3c', icon: null, requiredPoints: 400000, keepPoints: 220000, pointMultiplier: 2.5, cashbackPct: 15, weeklyBonus: 25000 },
  { id: 'l7', level: 7, name: 'Grand Master', color: '#f1c40f', icon: null, requiredPoints: 1000000, keepPoints: 600000, pointMultiplier: 3, cashbackPct: 20, weeklyBonus: 50000 },
]

let levels = [...DEFAULT_LEVELS]
let missions: AdminMission[] = [
  { id: 'm1', key: 'daily-spins', name: 'Daily Grind', description: 'Place 20 bets today', type: 'DAILY', metric: 'BET_COUNT', status: 'ACTIVE', target: 20, rewardPoints: 100, rewardStatusPoints: 100, sortOrder: 1, _count: { userMissions: 240 } },
  { id: 'm2', key: 'weekly-wager', name: 'High Roller', description: 'Wager $1000 this week', type: 'WEEKLY', metric: 'BET_AMOUNT', status: 'ACTIVE', target: 100000, rewardPoints: 1000, rewardStatusPoints: 1000, sortOrder: 1, _count: { userMissions: 88 } },
  { id: 'm3', key: 'slot-lover', name: 'Slot Lover', description: 'Play 50 slot rounds', type: 'DAILY', metric: 'GAME_CATEGORY_BETS', status: 'ACTIVE', target: 50, rewardPoints: 150, rewardStatusPoints: 150, sortOrder: 2, _count: { userMissions: 130 } },
  { id: 'm4', key: 'first-deposit', name: 'Welcome Aboard', description: 'Make your first deposit', type: 'ACHIEVEMENT', metric: 'DEPOSIT_AMOUNT', status: 'ACTIVE', target: 1, rewardPoints: 500, rewardStatusPoints: 0, sortOrder: 1, _count: { userMissions: 312 } },
]
let shop: AdminShopItem[] = [
  { id: 's1', sku: 'FS10', name: '10 Free Spins', description: 'On selected slots', type: 'FREE_SPINS', costPoints: 500, valueMinor: null, stock: null, minLevel: 0, enabled: true, sortOrder: 1 },
  { id: 's2', sku: 'BM5', name: '$5 Bonus Money', description: 'Instant bonus credit', type: 'BONUS_MONEY', costPoints: 1000, valueMinor: 500, stock: null, minLevel: 1, enabled: true, sortOrder: 2 },
  { id: 's3', sku: 'HEADSET', name: 'Gaming Headset', description: 'Premium VIP merch', type: 'PHYSICAL', costPoints: 50000, valueMinor: null, stock: 10, minLevel: 4, enabled: true, sortOrder: 3 },
]

async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await call()
  } catch {
    return fallback()
  }
}

export const loyaltyAdminService = {
  async levels(): Promise<AdminVipLevel[]> {
    return withFallback(
      async () => (await api.get<Envelope<AdminVipLevel[]>>('/loyalty/vip/levels')).data.data,
      () => levels,
    )
  },

  async analytics(): Promise<LoyaltyAnalytics> {
    return withFallback(
      async () => (await api.get<Envelope<LoyaltyAnalytics>>('/loyalty/admin/analytics')).data.data,
      () => ({
        totalPointsIssued: 8_420_000,
        totalPointsRedeemed: 3_180_000,
        redemptionRate: 0.378,
        totalRedemptions: 1240,
        levelDistribution: levels.map((l, i) => ({
          level: l.level,
          name: l.name,
          players: Math.max(2, Math.round(800 / (i + 1))),
        })),
      }),
    )
  },

  async pointConfig(): Promise<PointConfig> {
    return withFallback(
      async () => (await api.get<Envelope<{ points: PointConfig }>>('/loyalty/admin/settings')).data.data.points,
      () => ({
        loyaltyPerStakeMinor: 0.01,
        statusPerStakeMinor: 0.01,
        loyaltyPerDepositMinor: 0.05,
        statusPerDepositMinor: 0.05,
        categoryWeights: { SLOTS: 1, TABLE: 0.5, LIVE: 0.5, CRASH: 1, FISHING: 1, LOTTERY: 1, OTHER: 0.5 },
      }),
    )
  },

  async savePointConfig(value: PointConfig): Promise<void> {
    await withFallback(
      async () => {
        await api.put('/loyalty/admin/settings', { key: 'points', value })
      },
      () => undefined,
    )
  },

  async missions(): Promise<AdminMission[]> {
    return withFallback(
      async () => (await api.get<Envelope<AdminMission[]>>('/loyalty/admin/missions')).data.data,
      () => missions,
    )
  },

  async saveMission(data: MissionFormData): Promise<AdminMission> {
    return withFallback(
      async () => (await api.post<Envelope<AdminMission>>('/loyalty/admin/missions', data)).data.data,
      () => {
        if (data.id) {
          missions = missions.map((m) => (m.id === data.id ? { ...m, ...data } as AdminMission : m))
          return missions.find((m) => m.id === data.id)!
        }
        const row: AdminMission = { ...data, id: `m${Date.now()}`, description: data.description ?? null, _count: { userMissions: 0 } } as AdminMission
        missions = [...missions, row]
        return row
      },
    )
  },

  async saveLevel(data: LevelFormData): Promise<void> {
    await withFallback(
      async () => {
        if (data.id) await api.patch(`/loyalty/admin/levels/${data.id}`, data)
        else await api.post('/loyalty/admin/levels', data)
      },
      () => {
        if (data.id) {
          levels = levels.map((l) => (l.id === data.id ? { ...l, ...data, weeklyBonus: data.weeklyBonusMinor ?? l.weeklyBonus } as AdminVipLevel : l))
        } else {
          levels = [...levels, { ...data, id: `l${Date.now()}`, icon: null, color: data.color ?? null, weeklyBonus: data.weeklyBonusMinor ?? 0 } as AdminVipLevel].sort((a, b) => a.level - b.level)
        }
      },
    )
  },

  async shop(): Promise<AdminShopItem[]> {
    // No admin GET list endpoint for shop items; fall back to fixtures (player
    // shop endpoint is user-scoped). Mutations go through the live POST.
    return Promise.resolve(shop)
  },

  async saveShopItem(data: Partial<AdminShopItem> & { sku: string; name: string; type: string; costPoints: number }): Promise<void> {
    await withFallback(
      async () => {
        await api.post('/loyalty/admin/shop', data)
      },
      () => {
        if (data.id) {
          shop = shop.map((s) => (s.id === data.id ? ({ ...s, ...data } as AdminShopItem) : s))
        } else {
          shop = [...shop, { ...data, id: `s${Date.now()}`, description: data.description ?? null, valueMinor: data.valueMinor ?? null, stock: data.stock ?? null, minLevel: data.minLevel ?? 0, enabled: data.enabled ?? true, sortOrder: data.sortOrder ?? 99 } as AdminShopItem]
        }
      },
    )
  },

  async adjustPlayer(userId: string, loyaltyDelta: number, statusDelta: number, note?: string): Promise<void> {
    await api.post('/loyalty/admin/adjust', { userId, loyaltyDelta, statusDelta, note })
  },

  async playerOverview(userId: string) {
    const { data } = await api.get<Envelope<unknown>>(`/loyalty/admin/vip/${userId}`)
    return data.data
  },
}
