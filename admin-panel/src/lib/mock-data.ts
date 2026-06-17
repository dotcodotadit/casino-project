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
  KycLevel,
  GameType,
} from '@/types/admin.types'

/**
 * Deterministic demo fixtures. A seeded PRNG keeps the dataset stable across
 * reloads so tables/charts don't reshuffle. This is the data source behind the
 * admin service today; swapping to real /api/admin/* endpoints is isolated to
 * admin.service.ts.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260617)
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
// Fixed reference time so generated dates are stable (no Date.now in fixtures).
const NOW = new Date('2026-06-17T12:00:00Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

const FIRST = ['neo', 'trinity', 'morpheus', 'cipher', 'tank', 'dozer', 'switch', 'apoc', 'mouse', 'oracle', 'smith', 'link', 'niobe', 'ghost', 'sparks']
const STATUSES: UserStatus[] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED', 'BANNED', 'SELF_EXCLUDED']
const KYC: KycLevel[] = ['NONE', 'BASIC', 'BASIC', 'FULL', 'FULL']

export const mockUsers: AdminUser[] = Array.from({ length: 42 }, (_, i) => {
  const name = `${pick(FIRST)}_${int(10, 999)}`
  const dep = int(0, 500000)
  const wd = int(0, Math.floor(dep * 0.8))
  const kycLevel = pick(KYC)
  return {
    id: `usr_${(1000 + i).toString(36)}`,
    email: `${name}@example.com`,
    username: name,
    phone: rnd() > 0.3 ? `+1${int(2000000000, 9999999999)}` : null,
    role: i === 0 ? 'ADMIN' : i === 1 ? 'SUPPORT' : 'PLAYER',
    status: pick(STATUSES),
    kycLevel,
    kycStatus: kycLevel === 'FULL' ? 'VERIFIED' : rnd() > 0.6 ? 'PENDING' : 'NONE',
    balanceMinor: int(0, 250000),
    totalDepositedMinor: dep,
    totalWithdrawnMinor: wd,
    createdAt: daysAgo(int(1, 400)),
    lastLoginAt: rnd() > 0.1 ? hoursAgo(int(1, 720)) : null,
  }
})

export const mockGames: GameConfig[] = [
  { id: 'g_slots', game: 'SLOTS', displayName: 'Lucky Reels', rtp: 0.96, enabled: true, maintenance: false, minBetMinor: 10, maxBetMinor: 100000, jackpotMinor: 1_250_000, jackpotEnabled: true },
  { id: 'g_roulette', game: 'ROULETTE', displayName: 'European Roulette', rtp: 0.973, enabled: true, maintenance: false, minBetMinor: 10, maxBetMinor: 500000, jackpotMinor: 0, jackpotEnabled: false },
  { id: 'g_blackjack', game: 'BLACKJACK', displayName: 'Classic Blackjack', rtp: 0.995, enabled: true, maintenance: true, minBetMinor: 50, maxBetMinor: 200000, jackpotMinor: 0, jackpotEnabled: false },
]

const TX_TYPES = ['DEPOSIT', 'WITHDRAW', 'BET', 'PAYOUT', 'BONUS'] as const
const METHODS = ['CRYPTO_BTC', 'CRYPTO_ETH', 'CRYPTO_USDT', 'BANK_TRANSFER', null]
export const mockTransactions: FinanceTx[] = Array.from({ length: 120 }, (_, i) => {
  const u = pick(mockUsers)
  const type = pick([...TX_TYPES])
  return {
    id: `tx_${(50000 + i).toString(36)}`,
    userId: u.id,
    username: u.username,
    type,
    status: pick(['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED'] as const),
    amountMinor: int(500, 300000),
    method: type === 'DEPOSIT' || type === 'WITHDRAW' ? pick(METHODS) : null,
    createdAt: hoursAgo(int(1, 720)),
  }
})

const SUBJECTS = ['Withdrawal stuck', 'KYC not approved', 'Bonus missing', 'Login issue', 'Deposit not credited', 'Game froze mid-round', 'Account locked', 'Responsible gambling limit']
export const mockTickets: SupportTicket[] = Array.from({ length: 14 }, (_, i) => {
  const u = pick(mockUsers)
  const created = hoursAgo(int(1, 240))
  return {
    id: `tkt_${(700 + i).toString(36)}`,
    subject: pick(SUBJECTS),
    username: u.username,
    status: pick(['OPEN', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const),
    priority: pick(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const),
    createdAt: created,
    updatedAt: hoursAgo(int(0, 12)),
    messages: [
      { id: `m${i}a`, author: 'user', body: 'Hi, I need help with my account. This has been pending for a while.', createdAt: created },
      ...(rnd() > 0.5
        ? [{ id: `m${i}b`, author: 'agent' as const, body: 'Thanks for reaching out — we are looking into it now.', createdAt: hoursAgo(int(0, 6)) }]
        : []),
    ],
  }
})

export const mockSeeds: ServerSeed[] = [
  { id: 'seed_active', seedHash: 'a3f5c9e1b7d2486f0c1a9e8b4d6f2a7c3e5b9d1f8a0c2e4b6d8f0a1c3e5b7d9f', seed: null, active: true, roundsPlayed: 18342, createdAt: daysAgo(2), rotatedAt: null },
  { id: 'seed_prev1', seedHash: 'b1d3f5a7c9e1238456789abcdef0123456789abcdef0123456789abcdef01234', seed: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', active: false, roundsPlayed: 50211, createdAt: daysAgo(9), rotatedAt: daysAgo(2) },
  { id: 'seed_prev2', seedHash: 'c2e4f6a8b0d2468ace13579bdf02468ace13579bdf02468ace13579bdf02468a', seed: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f901', active: false, roundsPlayed: 47788, createdAt: daysAgo(16), rotatedAt: daysAgo(9) },
]

const GAMES: GameType[] = ['SLOTS', 'ROULETTE', 'BLACKJACK']
export const mockFairRounds: FairRound[] = Array.from({ length: 30 }, (_, i) => {
  const u = pick(mockUsers)
  const stake = int(100, 50000)
  return {
    id: `rnd_${(90000 + i).toString(36)}`,
    username: u.username,
    game: pick(GAMES),
    serverSeed: mockSeeds[1].seed!,
    serverSeedHash: mockSeeds[1].seedHash,
    clientSeed: `cs_${int(100000, 999999).toString(16)}`,
    nonce: i,
    stakeMinor: stake,
    payoutMinor: rnd() > 0.55 ? Math.round(stake * (1 + rnd() * 3)) : 0,
    createdAt: hoursAgo(int(1, 200)),
  }
})

export const mockTimeseries: TimeseriesPoint[] = Array.from({ length: 30 }, (_, i) => {
  const deposits = int(40000, 120000) / 100
  const withdrawals = int(20000, 90000) / 100
  return {
    date: daysAgo(29 - i).slice(5, 10), // MM-DD
    revenue: Math.round((deposits - withdrawals) * 100) / 100,
    deposits,
    withdrawals,
  }
})

export const mockGamePerformance: GamePerformance[] = [
  { game: 'SLOTS', betsMinor: 184_000_00, ggrMinor: 7_360_00, rtp: 0.96 },
  { game: 'ROULETTE', betsMinor: 96_500_00, ggrMinor: 2_605_00, rtp: 0.973 },
  { game: 'BLACKJACK', betsMinor: 142_300_00, ggrMinor: 711_00, rtp: 0.995 },
]

export const mockKpis: DashboardKpis = {
  revenueMinor: 10_676_00,
  revenueDeltaPct: 12.4,
  activeUsers: 1287,
  activeUsersDeltaPct: 8.1,
  ggrMinor: 10_676_00,
  ggrDeltaPct: 9.6,
  rtpRealtime: 0.968,
  pendingWithdrawals: mockTransactions.filter((t) => t.type === 'WITHDRAW' && t.status === 'PENDING').length,
  pendingKyc: mockUsers.filter((u) => u.kycStatus === 'PENDING').length,
  openTickets: mockTickets.filter((t) => t.status === 'OPEN').length,
}
