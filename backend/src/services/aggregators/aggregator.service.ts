import type { Provider } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { encryptJson, decryptJson } from '../../lib/crypto.js'
import { AppError } from '../../lib/errors.js'
import { aggregatorFactory } from './aggregator.factory.js'
import { sessionService } from './session.service.js'
import { ProviderError, type ProviderCode, type ProviderCredentials, type GameListQuery, type LaunchGameInput } from './types.js'
import type { IAggregatorProvider } from './aggregator.interface.js'

/**
 * Main aggregator facade — the single entry point used by controllers.
 * Orchestrates: provider registry/credentials, game catalog sync, and game
 * launches. Money movement lives in callback.service; this file never touches
 * the wallet directly.
 */

const PROVIDER_META: Record<ProviderCode, string> = {
  PGSOFT: 'PG Soft',
  PRAGMATIC: 'Pragmatic Play',
  EVOLUTION: 'Evolution',
  JILI: 'Jili',
}

/** Build a provider adapter using the row's encrypted creds (fallback: env). */
function adapterFor(row: Provider): IAggregatorProvider {
  let creds: ProviderCredentials | undefined
  if (row.credentialsEnc) {
    try {
      creds = decryptJson<ProviderCredentials>(row.credentialsEnc)
    } catch (e) {
      logger.error({ provider: row.code, err: (e as Error).message }, 'failed to decrypt provider credentials')
    }
  }
  return aggregatorFactory.create(row.code as ProviderCode, creds)
}

export const aggregatorService = {
  adapterFor,

  /** Idempotently create Provider rows for every supported adapter (seed). */
  async ensureSeeded(): Promise<void> {
    for (const code of aggregatorFactory.supported()) {
      const existing = await prisma.provider.findUnique({ where: { code } })
      if (existing) continue
      await prisma.provider.create({
        data: {
          code,
          name: PROVIDER_META[code],
          status: 'ACTIVE',
          credentialsEnc: encryptJson(aggregatorFactory.envCredentials(code)),
          supportedCurrencies: ['USD'],
        },
      })
      logger.info({ provider: code }, 'seeded provider')
    }
  },

  async listProviders() {
    return prisma.provider.findMany({ orderBy: { code: 'asc' } })
  },

  async getProviderByCode(code: ProviderCode): Promise<Provider> {
    const row = await prisma.provider.findUnique({ where: { code } })
    if (!row) throw new ProviderError('PROVIDER_UNKNOWN', `Provider ${code} not configured`, 404)
    return row
  },

  /**
   * Pull the provider's catalog and upsert into Game. Used by manual import or a
   * scheduled sync job. Returns the number of games synced.
   */
  async syncGames(code: ProviderCode): Promise<number> {
    const provider = await this.getProviderByCode(code)
    const adapter = adapterFor(provider)
    const games = await adapter.getGameList()
    for (const g of games) {
      await prisma.game.upsert({
        where: { providerId_externalId: { providerId: provider.id, externalId: g.externalId } },
        create: {
          providerId: provider.id,
          externalId: g.externalId,
          name: g.name,
          category: g.category,
          rtp: g.rtp,
          thumbnailUrl: g.thumbnailUrl || null,
          currencies: g.currencies,
        },
        update: { name: g.name, category: g.category, rtp: g.rtp },
      })
    }
    logger.info({ provider: code, count: games.length }, 'synced provider games')
    return games.length
  },

  /** Sync all providers (e.g. nightly cron). */
  async syncAll(): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const code of aggregatorFactory.supported()) {
      try {
        out[code] = await this.syncGames(code)
      } catch (e) {
        logger.error({ provider: code, err: (e as Error).message }, 'game sync failed')
        out[code] = -1
      }
    }
    return out
  },

  /** Paginated, filterable game list for the player lobby. */
  async getGames(query: GameListQuery) {
    const where = {
      enabled: true,
      provider: { status: 'ACTIVE' as const },
      ...(query.provider ? { provider: { code: query.provider, status: 'ACTIVE' as const } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
    }
    const [total, rows] = await prisma.$transaction([
      prisma.game.count({ where }),
      prisma.game.findMany({
        where,
        include: { provider: { select: { code: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])
    return {
      items: rows.map((g) => ({
        id: g.id,
        externalId: g.externalId,
        name: g.name,
        category: g.category,
        rtp: g.rtp,
        maintenance: g.maintenance,
        thumbnailUrl: g.thumbnailUrl,
        provider: g.provider,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    }
  },

  /**
   * Launch a game: validate provider/game availability, then issue a session.
   * Throws ProviderError with a code that maps to a user-friendly message.
   */
  async launchGame(user: { id: string; username: string }, input: LaunchGameInput) {
    const provider = await this.getProviderByCode(input.provider)
    if (provider.status === 'DISABLED') throw new ProviderError('PROVIDER_DISABLED', 'Provider disabled', 403)
    if (provider.status === 'MAINTENANCE') throw new ProviderError('GAME_MAINTENANCE', 'Provider in maintenance', 503)

    const game = await prisma.game.findUnique({
      where: { providerId_externalId: { providerId: provider.id, externalId: input.gameId } },
    })
    if (!game || !game.enabled) throw new ProviderError('GAME_NOT_FOUND', 'Game not available', 404)
    if (game.maintenance) throw new ProviderError('GAME_MAINTENANCE', 'Game under maintenance', 503)
    if (!provider.supportedCurrencies.includes(input.currency)) {
      throw new ProviderError('CURRENCY_UNSUPPORTED', 'Currency not supported', 400)
    }

    const adapter = adapterFor(provider)
    const { sessionId, token, launchUrl } = await sessionService.create({
      userId: user.id,
      username: user.username,
      provider,
      game,
      adapter,
      currency: input.currency,
      lang: input.lang,
    })

    return { sessionId, token, launchUrl, gameName: game.name, provider: provider.code }
  },

  /** Toggle provider status / update credentials (admin). */
  async updateProvider(code: ProviderCode, patch: { status?: Provider['status']; credentials?: ProviderCredentials; callbackIpWhitelist?: string[] }) {
    const data: Record<string, unknown> = {}
    if (patch.status) data.status = patch.status
    if (patch.callbackIpWhitelist) data.callbackIpWhitelist = patch.callbackIpWhitelist
    if (patch.credentials) data.credentialsEnc = encryptJson(patch.credentials)
    const row = await prisma.provider.update({ where: { code }, data })
    return row
  },

  async getMainBalanceMinor(userId: string): Promise<number> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId_type_currency: { userId, type: 'MAIN', currency: 'USD' } },
    })
    if (!wallet) throw AppError.notFound('Wallet not found', 'WALLET_NOT_FOUND')
    return Number(wallet.balance)
  },
}
