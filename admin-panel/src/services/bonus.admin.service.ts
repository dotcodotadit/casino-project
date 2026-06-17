import { api } from '@/lib/api'
import type {
  AdminBonus,
  BonusFormData,
  BonusCondition,
  ClaimRow,
  BonusAnalytics,
  AbuseFlag,
} from '@/types/bonus.types'

interface Envelope<T> {
  success: boolean
  data: T
}

/**
 * Admin bonus service. Unlike the older demo pages, these endpoints exist on the
 * backend (`/api/bonus/admin/*`). Each call hits the live API but falls back to
 * deterministic fixtures when the backend is unreachable, so the panel always
 * renders during development. Mutations update fixtures in-place for that case.
 */
const FIXTURE_BONUSES: AdminBonus[] = [
  {
    id: 'fx-welcome',
    code: null,
    name: 'Welcome 100% up to $500',
    kind: 'WELCOME',
    rewardType: 'PERCENTAGE',
    claimMode: 'AUTO',
    status: 'ACTIVE',
    percentage: 1,
    maxAmount: 50000,
    wagerMultiplier: 35,
    priority: 100,
    claims: 312,
    conditions: 2,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'fx-reload',
    code: null,
    name: 'Weekend Reload 50%',
    kind: 'RELOAD',
    rewardType: 'PERCENTAGE',
    claimMode: 'AUTO',
    status: 'ACTIVE',
    percentage: 0.5,
    maxAmount: 20000,
    wagerMultiplier: 25,
    priority: 50,
    claims: 88,
    conditions: 1,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'fx-cashback',
    code: null,
    name: 'Daily 10% Cashback',
    kind: 'CASHBACK',
    rewardType: 'PERCENTAGE',
    claimMode: 'AUTO',
    status: 'ACTIVE',
    percentage: 0.1,
    maxAmount: 10000,
    wagerMultiplier: 0,
    priority: 40,
    claims: 540,
    conditions: 0,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'fx-code',
    code: 'FREESPINS50',
    name: '50 Free Spins',
    kind: 'FREE_SPIN',
    rewardType: 'FREE_SPINS',
    claimMode: 'CODE',
    status: 'PAUSED',
    percentage: null,
    maxAmount: null,
    wagerMultiplier: 20,
    priority: 10,
    claims: 17,
    conditions: 1,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
]

let fixtures = [...FIXTURE_BONUSES]

async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await call()
  } catch {
    return fallback()
  }
}

export const bonusAdminService = {
  async list(): Promise<AdminBonus[]> {
    return withFallback(
      async () => (await api.get<Envelope<AdminBonus[]>>('/bonus/admin/list')).data.data,
      () => fixtures,
    )
  },

  async analytics(): Promise<BonusAnalytics> {
    return withFallback(
      async () => (await api.get<Envelope<BonusAnalytics>>('/bonus/admin/analytics')).data.data,
      () => ({
        byStatus: [
          { status: 'ACTIVE', count: 124 },
          { status: 'COMPLETED', count: 642 },
          { status: 'EXPIRED', count: 73 },
          { status: 'FORFEITED', count: 21 },
        ],
        byKind: [
          { kind: 'WELCOME', count: 312 },
          { kind: 'RELOAD', count: 88 },
          { kind: 'CASHBACK', count: 540 },
          { kind: 'FREE_SPIN', count: 17 },
        ],
        totalGranted: 4_820_000,
        totalReleased: 2_910_000,
        conversionRate: 0.604,
        openAbuseFlags: 4,
      }),
    )
  },

  async claims(page = 1): Promise<{ items: ClaimRow[]; total: number; totalPages: number }> {
    return withFallback(
      async () => (await api.get<Envelope<{ items: ClaimRow[]; total: number; totalPages: number }>>(`/bonus/admin/history?page=${page}&pageSize=20`)).data.data,
      () => {
        const items: ClaimRow[] = Array.from({ length: 12 }).map((_, i) => ({
          id: `fx-claim-${i}`,
          user: `player${i + 1}`,
          email: `player${i + 1}@demo.dev`,
          bonus: fixtures[i % fixtures.length].name,
          kind: fixtures[i % fixtures.length].kind,
          status: ['ACTIVE', 'COMPLETED', 'EXPIRED'][i % 3],
          granted: 10000 + i * 1500,
          wagerRequired: (10000 + i * 1500) * 35,
          wagerProgress: Math.floor((10000 + i * 1500) * 35 * (i % 3 === 1 ? 1 : 0.4)),
          released: i % 3 === 1 ? 10000 + i * 1500 : 0,
          createdAt: new Date(Date.now() - i * 3600000).toISOString(),
        }))
        return { items, total: items.length, totalPages: 1 }
      },
    )
  },

  async abuseFlags(): Promise<AbuseFlag[]> {
    return withFallback(
      async () => (await api.get<Envelope<AbuseFlag[]>>('/bonus/admin/abuse?resolved=false')).data.data,
      () => [
        { id: 'fx-f1', user: 'player7', email: 'player7@demo.dev', reason: 'DUP_IP', severity: 'HIGH', details: { accounts: 4 }, resolved: false, createdAt: new Date().toISOString() },
        { id: 'fx-f2', user: 'player3', email: 'player3@demo.dev', reason: 'MIN_BET_PATTERN', severity: 'MEDIUM', details: { ratio: 0.92 }, resolved: false, createdAt: new Date().toISOString() },
      ],
    )
  },

  async create(data: BonusFormData): Promise<AdminBonus> {
    return withFallback(
      async () => (await api.post<Envelope<AdminBonus>>('/bonus/admin', data)).data.data,
      () => {
        const row: AdminBonus = {
          id: `fx-${Date.now()}`,
          code: data.code ?? null,
          name: data.name,
          kind: data.kind,
          rewardType: data.rewardType,
          claimMode: data.claimMode,
          status: data.status,
          percentage: data.percentage ?? null,
          maxAmount: data.maxAmountMinor ?? null,
          wagerMultiplier: data.wagerMultiplier,
          priority: data.priority,
          claims: 0,
          conditions: 0,
          createdAt: new Date().toISOString(),
        }
        fixtures = [row, ...fixtures]
        return row
      },
    )
  },

  async update(id: string, data: Partial<BonusFormData>): Promise<AdminBonus> {
    return withFallback(
      async () => {
        await api.patch(`/bonus/admin/${id}`, data)
        return (await api.get<Envelope<AdminBonus[]>>('/bonus/admin/list')).data.data.find((b) => b.id === id)!
      },
      () => {
        fixtures = fixtures.map((b) =>
          b.id === id
            ? { ...b, ...data, maxAmount: data.maxAmountMinor ?? b.maxAmount, percentage: data.percentage ?? b.percentage }
            : b,
        )
        return fixtures.find((b) => b.id === id)!
      },
    )
  },

  async setStatus(id: string, status: AdminBonus['status']): Promise<void> {
    await withFallback(
      async () => {
        await api.post(`/bonus/admin/${id}/status`, { status })
      },
      () => {
        fixtures = fixtures.map((b) => (b.id === id ? { ...b, status } : b))
      },
    )
  },

  async setConditions(id: string, conditions: BonusCondition[]): Promise<void> {
    await withFallback(
      async () => {
        await api.put(`/bonus/admin/${id}/conditions`, { conditions })
      },
      () => {
        fixtures = fixtures.map((b) => (b.id === id ? { ...b, conditions: conditions.length } : b))
      },
    )
  },

  async resolveAbuse(id: string): Promise<void> {
    await withFallback(
      async () => {
        await api.post(`/bonus/admin/abuse/${id}/resolve`, {})
      },
      () => undefined,
    )
  },
}
