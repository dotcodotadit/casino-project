import { create } from 'zustand'
import { bonusService } from '@/services/bonus.service'
import { notify } from '@/store/useNotifications'
import type {
  AvailableBonus,
  UserBonus,
  FreeSpinPackage,
  Promotion,
  BonusProgressEvent,
  BonusCompletedEvent,
  BonusEndedEvent,
} from '@/types/bonus.types'

interface BonusState {
  available: AvailableBonus[]
  active: UserBonus[] // ACTIVE/PENDING
  history: UserBonus[]
  freeSpins: FreeSpinPackage[]
  promotions: Promotion[]
  loading: boolean
  claiming: string | null // bonus id being claimed

  fetchAll: () => Promise<void>
  fetchActive: () => Promise<void>
  fetchPromotions: () => Promise<void>
  claim: (input: { bonusId?: string; code?: string }) => Promise<boolean>
  cancel: (userBonusId: string) => Promise<void>

  // ── Socket-driven realtime updates ──
  applyProgress: (e: BonusProgressEvent) => void
  applyCompleted: (e: BonusCompletedEvent) => void
  applyEnded: (e: BonusEndedEvent) => void

  reset: () => void
}

export const useBonusStore = create<BonusState>((set, get) => ({
  available: [],
  active: [],
  history: [],
  freeSpins: [],
  promotions: [],
  loading: false,
  claiming: null,

  fetchAll: async () => {
    set({ loading: true })
    try {
      const [available, mine, freeSpins] = await Promise.all([
        bonusService.available(),
        bonusService.mine(),
        bonusService.freeSpins(),
      ])
      set({
        available,
        active: mine.filter((b) => b.status === 'ACTIVE' || b.status === 'PENDING'),
        history: mine.filter((b) => b.status !== 'ACTIVE' && b.status !== 'PENDING'),
        freeSpins,
      })
    } finally {
      set({ loading: false })
    }
  },

  fetchActive: async () => {
    const progress = await bonusService.progress()
    set({ active: progress })
  },

  fetchPromotions: async () => {
    const promotions = await bonusService.promotions()
    set({ promotions })
  },

  claim: async (input) => {
    set({ claiming: input.bonusId ?? 'code' })
    try {
      const ub = await bonusService.claim(input)
      notify({ title: 'Bonus claimed', message: `${ub.name} is now active`, variant: 'success' })
      await get().fetchAll()
      return true
    } catch (err: any) {
      notify({
        title: 'Could not claim bonus',
        message: err?.response?.data?.error?.message ?? 'Please try again',
        variant: 'error',
      })
      return false
    } finally {
      set({ claiming: null })
    }
  },

  cancel: async (userBonusId) => {
    try {
      await bonusService.cancel(userBonusId)
      notify({ title: 'Bonus cancelled', variant: 'info' })
      await get().fetchAll()
    } catch (err: any) {
      notify({
        title: 'Could not cancel bonus',
        message: err?.response?.data?.error?.message ?? 'Please try again',
        variant: 'error',
      })
    }
  },

  applyProgress: (e) =>
    set((s) => ({
      active: s.active.map((b) =>
        b.id === e.userBonusId
          ? { ...b, wagerProgress: e.progressMinor, wagerRequired: e.requiredMinor, wagerPercent: e.percent }
          : b,
      ),
    })),

  applyCompleted: (e) => {
    const target = get().active.find((b) => b.id === e.userBonusId)
    if (target) {
      notify({
        title: 'Wagering complete!',
        message: `${target.name} funds released to your balance`,
        variant: 'win',
      })
    }
    // Move it to history (it will be reconciled on next fetch).
    set((s) => ({
      active: s.active.filter((b) => b.id !== e.userBonusId),
      history: target
        ? [{ ...target, status: 'COMPLETED', wagerPercent: 100 }, ...s.history]
        : s.history,
    }))
  },

  applyEnded: (e) =>
    set((s) => {
      const target = s.active.find((b) => b.id === e.userBonusId)
      return {
        active: s.active.filter((b) => b.id !== e.userBonusId),
        history: target
          ? [{ ...target, status: e.reason === 'expired' ? 'EXPIRED' : 'CANCELLED' }, ...s.history]
          : s.history,
      }
    }),

  reset: () =>
    set({ available: [], active: [], history: [], freeSpins: [], promotions: [], loading: false, claiming: null }),
}))
