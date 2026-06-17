import type {
  AdminUser,
  GameConfig,
  FinanceTx,
  SupportTicket,
  ServerSeed,
  FairRound,
  DashboardKpis,
  TimeseriesPoint,
  GamePerformance,
  UserStatus,
  TicketStatus,
} from '@/types/admin.types'
import {
  mockUsers,
  mockGames,
  mockTransactions,
  mockTickets,
  mockSeeds,
  mockFairRounds,
  mockKpis,
  mockTimeseries,
  mockGamePerformance,
} from '@/lib/mock-data'

/**
 * Admin service. Each method is a single seam: today it resolves from in-memory
 * fixtures (simulating latency); switching to live data means replacing the body
 * with an `api.get/post('/admin/...')` call. Mutations update the fixtures so the
 * UI behaves like a real app within a session.
 */
const delay = <T>(value: T, ms = 250): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms))

// SHA-256 commit verification via Web Crypto (used by the fairness verifier).
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const adminService = {
  // ── Dashboard ──
  async getDashboard(): Promise<{ kpis: DashboardKpis; timeseries: TimeseriesPoint[]; games: GamePerformance[] }> {
    return delay({ kpis: mockKpis, timeseries: mockTimeseries, games: mockGamePerformance })
  },

  // ── Users ──
  async listUsers(): Promise<AdminUser[]> {
    return delay([...mockUsers])
  },
  async setUserStatus(id: string, status: UserStatus): Promise<AdminUser> {
    const u = mockUsers.find((x) => x.id === id)!
    u.status = status
    return delay({ ...u }, 150)
  },
  async approveKyc(id: string): Promise<AdminUser> {
    const u = mockUsers.find((x) => x.id === id)!
    u.kycStatus = 'VERIFIED'
    u.kycLevel = 'FULL'
    return delay({ ...u }, 150)
  },
  async rejectKyc(id: string): Promise<AdminUser> {
    const u = mockUsers.find((x) => x.id === id)!
    u.kycStatus = 'REJECTED'
    return delay({ ...u }, 150)
  },
  async adjustBalance(id: string, deltaMinor: number): Promise<AdminUser> {
    const u = mockUsers.find((x) => x.id === id)!
    u.balanceMinor = Math.max(0, u.balanceMinor + deltaMinor)
    return delay({ ...u }, 150)
  },

  // ── Games ──
  async listGames(): Promise<GameConfig[]> {
    return delay([...mockGames])
  },
  async updateGame(id: string, patch: Partial<GameConfig>): Promise<GameConfig> {
    const g = mockGames.find((x) => x.id === id)!
    Object.assign(g, patch)
    return delay({ ...g }, 150)
  },

  // ── Finance ──
  async listTransactions(): Promise<FinanceTx[]> {
    return delay([...mockTransactions])
  },
  async financeSummary(): Promise<{
    depositsMinor: number
    withdrawalsMinor: number
    betsMinor: number
    payoutsMinor: number
    ggrMinor: number
    netProfitMinor: number
  }> {
    const sum = (t: FinanceTx['type']) =>
      mockTransactions.filter((x) => x.type === t && x.status === 'COMPLETED').reduce((a, x) => a + x.amountMinor, 0)
    const deposits = sum('DEPOSIT')
    const withdrawals = sum('WITHDRAW')
    const bets = sum('BET')
    const payouts = sum('PAYOUT')
    const ggr = bets - payouts
    return delay({
      depositsMinor: deposits,
      withdrawalsMinor: withdrawals,
      betsMinor: bets,
      payoutsMinor: payouts,
      ggrMinor: ggr,
      netProfitMinor: ggr,
    })
  },

  // ── Support ──
  async listTickets(): Promise<SupportTicket[]> {
    return delay([...mockTickets])
  },
  async replyTicket(id: string, body: string): Promise<SupportTicket> {
    const t = mockTickets.find((x) => x.id === id)!
    t.messages.push({ id: `m_${t.messages.length}`, author: 'agent', body, createdAt: new Date().toISOString() })
    t.status = 'PENDING'
    t.updatedAt = new Date().toISOString()
    return delay({ ...t, messages: [...t.messages] }, 120)
  },
  async setTicketStatus(id: string, status: TicketStatus): Promise<SupportTicket> {
    const t = mockTickets.find((x) => x.id === id)!
    t.status = status
    t.updatedAt = new Date().toISOString()
    return delay({ ...t }, 120)
  },

  // ── Provably fair ──
  async listFairRounds(): Promise<FairRound[]> {
    return delay([...mockFairRounds])
  },
  /** Verify revealed serverSeed hashes to its published commit. */
  async verifyCommit(serverSeed: string, expectedHash: string): Promise<boolean> {
    return (await sha256Hex(serverSeed)) === expectedHash.toLowerCase()
  },

  // ── Server seeds ──
  async listSeeds(): Promise<ServerSeed[]> {
    return delay([...mockSeeds])
  },
  async rotateSeed(): Promise<{ revealedHash: string | null; newHash: string }> {
    const active = mockSeeds.find((s) => s.active)
    const newHash = (await sha256Hex(`server-seed-${Date.now()}-${Math.random()}`)).slice(0, 64)
    if (active) {
      active.active = false
      active.rotatedAt = new Date().toISOString()
      active.seed = `revealed_${active.id}`
    }
    mockSeeds.unshift({
      id: `seed_${Date.now().toString(36)}`,
      seedHash: newHash,
      seed: null,
      active: true,
      roundsPlayed: 0,
      createdAt: new Date().toISOString(),
      rotatedAt: null,
    })
    return delay({ revealedHash: active?.seedHash ?? null, newHash }, 200)
  },
}
