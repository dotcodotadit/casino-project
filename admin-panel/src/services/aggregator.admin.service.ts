import type {
  AdminProvider,
  AdminGame,
  AdminSession,
  AdminProviderTx,
  AdminCallback,
  ProviderCode,
  ProviderStatus,
} from '@/types/aggregator.types'

/**
 * Admin aggregator service. Like the rest of the admin panel it resolves from
 * deterministic in-memory fixtures (single seam to the real /api/aggregator/admin
 * endpoints, which already exist on the backend). Mutations update the fixtures
 * so the UI behaves like a live app within a session.
 */
const delay = <T>(v: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(v), ms))

const CATALOG: Record<ProviderCode, { externalId: string; name: string; category: string; rtp: number }[]> = {
  PGSOFT: [
    { externalId: 'pg-mahjong-ways', name: 'Mahjong Ways', category: 'SLOTS', rtp: 0.965 },
    { externalId: 'pg-fortune-tiger', name: 'Fortune Tiger', category: 'SLOTS', rtp: 0.969 },
    { externalId: 'pg-wild-bandito', name: 'Wild Bandito', category: 'SLOTS', rtp: 0.964 },
    { externalId: 'pg-lucky-neko', name: 'Lucky Neko', category: 'SLOTS', rtp: 0.965 },
  ],
  PRAGMATIC: [
    { externalId: 'pp-gates-of-olympus', name: 'Gates of Olympus', category: 'SLOTS', rtp: 0.965 },
    { externalId: 'pp-sweet-bonanza', name: 'Sweet Bonanza', category: 'SLOTS', rtp: 0.965 },
    { externalId: 'pp-mega-roulette', name: 'Mega Roulette', category: 'LIVE', rtp: 0.974 },
  ],
  EVOLUTION: [
    { externalId: 'evo-lightning-roulette', name: 'Lightning Roulette', category: 'LIVE', rtp: 0.974 },
    { externalId: 'evo-crazy-time', name: 'Crazy Time', category: 'LIVE', rtp: 0.953 },
  ],
  JILI: [
    { externalId: 'jili-super-ace', name: 'Super Ace', category: 'SLOTS', rtp: 0.97 },
    { externalId: 'jili-fishing-war', name: 'Fishing War', category: 'FISHING', rtp: 0.97 },
  ],
}

let providers: AdminProvider[] = [
  { id: 'p1', code: 'PGSOFT', name: 'PG Soft', status: 'ACTIVE', aggregator: null, supportedCurrencies: ['USD'], callbackIpWhitelist: ['52.10.0.0/16'], hasCredentials: true, gamesCount: CATALOG.PGSOFT.length },
  { id: 'p2', code: 'PRAGMATIC', name: 'Pragmatic Play', status: 'ACTIVE', aggregator: null, supportedCurrencies: ['USD'], callbackIpWhitelist: [], hasCredentials: true, gamesCount: CATALOG.PRAGMATIC.length },
  { id: 'p3', code: 'EVOLUTION', name: 'Evolution', status: 'MAINTENANCE', aggregator: 'HUB88', supportedCurrencies: ['USD'], callbackIpWhitelist: ['185.20.0.0/16'], hasCredentials: true, gamesCount: CATALOG.EVOLUTION.length },
  { id: 'p4', code: 'JILI', name: 'Jili', status: 'ACTIVE', aggregator: null, supportedCurrencies: ['USD'], callbackIpWhitelist: [], hasCredentials: true, gamesCount: CATALOG.JILI.length },
]

let games: AdminGame[] = (Object.keys(CATALOG) as ProviderCode[]).flatMap((code) =>
  CATALOG[code].map((g, i) => ({
    id: `${code}-${i}`,
    provider: code,
    externalId: g.externalId,
    name: g.name,
    category: g.category,
    rtp: g.rtp,
    enabled: true,
    maintenance: code === 'EVOLUTION',
  })),
)

const now = Date.parse('2026-06-17T12:00:00Z')
const ago = (m: number) => new Date(now - m * 60000).toISOString()

const sessions: AdminSession[] = Array.from({ length: 12 }, (_, i) => {
  const code = (['PGSOFT', 'PRAGMATIC', 'EVOLUTION', 'JILI'] as ProviderCode[])[i % 4]
  return {
    id: `sess_${i}`,
    user: `player_${100 + i}`,
    provider: code,
    game: CATALOG[code][0].name,
    currency: 'USD',
    status: i < 4 ? 'ACTIVE' : i < 9 ? 'CLOSED' : 'EXPIRED',
    createdAt: ago(i * 13),
    expiresAt: ago(i * 13 - 60),
  }
})

const ptx: AdminProviderTx[] = Array.from({ length: 40 }, (_, i) => {
  const code = (['PGSOFT', 'PRAGMATIC', 'EVOLUTION', 'JILI'] as ProviderCode[])[i % 4]
  const type = (['BET', 'WIN', 'BET', 'ROLLBACK'] as const)[i % 4]
  return {
    id: `ptx_${i}`,
    user: `player_${100 + (i % 12)}`,
    provider: code,
    type,
    status: 'COMPLETED' as const,
    roundId: `R${1000 + i}`,
    providerTxId: `${code}-${50000 + i}`,
    amountMinor: 500 + i * 137,
    balanceAfter: 100000 - i * 200,
    createdAt: ago(i * 3),
  }
})

let callbacks: AdminCallback[] = Array.from({ length: 24 }, (_, i) => {
  const code = (['PGSOFT', 'PRAGMATIC', 'EVOLUTION', 'JILI'] as ProviderCode[])[i % 4]
  const failed = i % 7 === 3
  return {
    id: `cb_${i}`,
    providerCode: code,
    action: (['bet', 'win', 'balance', 'rollback'] as const)[i % 4],
    ipAddress: `52.10.0.${i + 1}`,
    signatureValid: !(i % 11 === 5),
    status: failed ? 'FAILED' : i % 5 === 0 ? 'RECEIVED' : 'PROCESSED',
    idempotencyKey: `${code}:bet:${60000 + i}`,
    error: failed ? 'WALLET_CONFLICT: concurrent balance update' : null,
    attempts: failed ? 2 : 1,
    createdAt: ago(i * 2),
  }
})

export const aggregatorAdminService = {
  async listProviders() {
    return delay(providers.map((p) => ({ ...p, gamesCount: games.filter((g) => g.provider === p.code).length })))
  },
  async setProviderStatus(code: ProviderCode, status: ProviderStatus) {
    providers = providers.map((p) => (p.code === code ? { ...p, status } : p))
    return delay(providers.find((p) => p.code === code)!)
  },
  async syncGames(code: ProviderCode) {
    // In the real backend this pulls the provider catalog; here it's a no-op count.
    return delay({ provider: code, synced: CATALOG[code].length })
  },

  async listGames() {
    return delay([...games])
  },
  async updateGame(id: string, patch: Partial<Pick<AdminGame, 'rtp' | 'enabled' | 'maintenance'>>) {
    games = games.map((g) => (g.id === id ? { ...g, ...patch } : g))
    return delay(games.find((g) => g.id === id)!)
  },

  async listSessions() {
    return delay([...sessions])
  },
  async listProviderTransactions() {
    return delay([...ptx])
  },

  async listCallbacks() {
    return delay([...callbacks])
  },
  async retryCallback(id: string) {
    callbacks = callbacks.map((c) => (c.id === id ? { ...c, status: 'PROCESSED', error: null, attempts: c.attempts + 1 } : c))
    return delay(callbacks.find((c) => c.id === id)!)
  },
}
