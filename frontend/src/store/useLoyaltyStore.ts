import { create } from 'zustand'
import { loyaltyService } from '@/services/loyalty.service'
import { notify } from '@/store/useNotifications'
import type {
  VipLevel,
  VipBenefit,
  VipProgress,
  Mission,
  ShopItem,
  Redemption,
  PointsEvent,
  LevelUpEvent,
  MissionProgressEvent,
  MissionCompletedEvent,
} from '@/types/loyalty.types'

interface LoyaltyState {
  levels: VipLevel[]
  progress: VipProgress | null
  benefits: VipBenefit[]
  missions: Mission[]
  shop: ShopItem[]
  redemptions: Redemption[]
  loading: boolean
  claiming: string | null
  redeeming: string | null

  // Most recent level-up event (drives LevelUpModal). Cleared after shown.
  levelUpEvent: LevelUpEvent | null
  clearLevelUp: () => void

  fetchVip: () => Promise<void>
  fetchMissions: () => Promise<void>
  fetchShop: () => Promise<void>
  fetchAll: () => Promise<void>
  claimMission: (id: string) => Promise<void>
  redeem: (itemId: string) => Promise<void>

  // ── Socket-driven realtime ──
  applyPoints: (e: PointsEvent) => void
  applyLevelUp: (e: LevelUpEvent) => void
  applyMissionProgress: (e: MissionProgressEvent) => void
  applyMissionCompleted: (e: MissionCompletedEvent) => void

  reset: () => void
}

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  levels: [],
  progress: null,
  benefits: [],
  missions: [],
  shop: [],
  redemptions: [],
  loading: false,
  claiming: null,
  redeeming: null,
  levelUpEvent: null,
  clearLevelUp: () => set({ levelUpEvent: null }),

  fetchVip: async () => {
    const [{ progress, benefits }, levels] = await Promise.all([
      loyaltyService.vipMe(),
      loyaltyService.vipLevels(),
    ])
    set({ progress, benefits, levels })
  },

  fetchMissions: async () => {
    set({ missions: await loyaltyService.missions() })
  },

  fetchShop: async () => {
    const [shop, redemptions] = await Promise.all([loyaltyService.shop(), loyaltyService.redemptions()])
    set({ shop, redemptions })
  },

  fetchAll: async () => {
    set({ loading: true })
    try {
      await Promise.all([get().fetchVip(), get().fetchMissions(), get().fetchShop()])
    } finally {
      set({ loading: false })
    }
  },

  claimMission: async (id) => {
    set({ claiming: id })
    try {
      const { rewardPoints } = await loyaltyService.claimMission(id)
      notify({ title: 'Mission reward claimed', message: `+${rewardPoints} points`, variant: 'win' })
      await Promise.all([get().fetchMissions(), get().fetchVip()])
    } catch (err: any) {
      notify({ title: 'Claim failed', message: err?.response?.data?.error?.message ?? 'Try again', variant: 'error' })
    } finally {
      set({ claiming: null })
    }
  },

  redeem: async (itemId) => {
    set({ redeeming: itemId })
    try {
      const r = await loyaltyService.redeem(itemId)
      notify({ title: 'Redeemed!', message: `${r.item} for ${r.costPoints} pts`, variant: 'success' })
      await Promise.all([get().fetchShop(), get().fetchVip()])
    } catch (err: any) {
      notify({ title: 'Redemption failed', message: err?.response?.data?.error?.message ?? 'Try again', variant: 'error' })
    } finally {
      set({ redeeming: null })
    }
  },

  applyPoints: (e) =>
    set((s) =>
      s.progress
        ? { progress: { ...s.progress, loyaltyPoints: e.loyaltyBalance, statusPoints: s.progress.statusPoints + e.statusPoints } }
        : {},
    ),

  applyLevelUp: (e) => {
    notify({ title: `Level up! ${e.levelName}`, message: `You reached VIP level ${e.toLevel}`, variant: 'win' })
    set({ levelUpEvent: e })
    void get().fetchVip()
  },

  applyMissionProgress: (e) =>
    set((s) => ({
      missions: s.missions.map((m) =>
        m.id === e.userMissionId ? { ...m, progress: e.progress, percent: e.percent } : m,
      ),
    })),

  applyMissionCompleted: (e) => {
    notify({ title: 'Mission complete!', message: 'Claim your reward', variant: 'win' })
    set((s) => ({
      missions: s.missions.map((m) => (m.id === e.userMissionId ? { ...m, status: 'COMPLETED', percent: 100 } : m)),
    }))
  },

  reset: () =>
    set({
      levels: [],
      progress: null,
      benefits: [],
      missions: [],
      shop: [],
      redemptions: [],
      loading: false,
      claiming: null,
      redeeming: null,
      levelUpEvent: null,
    }),
}))
