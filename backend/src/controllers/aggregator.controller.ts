import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'
import { aggregatorService } from '../services/aggregators/aggregator.service.js'
import { aggregatorFactory } from '../services/aggregators/aggregator.factory.js'
import { callbackService } from '../services/aggregators/callback.service.js'
import { decryptJson } from '../lib/crypto.js'
import { launchGameSchema, gameListQuerySchema, type ProviderCode, type ProviderCredentials } from '../services/aggregators/types.js'

const updateProviderSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED', 'MAINTENANCE']).optional(),
  callbackIpWhitelist: z.array(z.string()).optional(),
  credentials: z.object({ apiKey: z.string(), secret: z.string(), endpoint: z.string().url() }).optional(),
})

export const aggregatorController = {
  // ── Player ──
  async getProviders(_req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await aggregatorService.listProviders()
      ok(
        res,
        rows.filter((p) => p.status !== 'DISABLED').map((p) => ({ code: p.code, name: p.name, status: p.status })),
      )
    } catch (e) {
      next(e)
    }
  },

  async getGames(req: Request, res: Response, next: NextFunction) {
    try {
      const q = gameListQuerySchema.parse(req.query)
      ok(res, await aggregatorService.getGames(q))
    } catch (e) {
      next(e)
    }
  },

  async launch(req: Request, res: Response, next: NextFunction) {
    try {
      const input = launchGameSchema.parse(req.body)
      const result = await aggregatorService.launchGame(
        { id: req.auth!.sub, username: req.auth!.username },
        input,
      )
      ok(res, result, 201)
    } catch (e) {
      next(e)
    }
  },

  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const balanceMinor = await aggregatorService.getMainBalanceMinor(req.auth!.sub)
      ok(res, { balanceMinor, balance: Number((balanceMinor / 100).toFixed(2)), currency: 'USD' })
    } catch (e) {
      next(e)
    }
  },

  // ── Admin (role-gated by route) ──
  async adminProviders(_req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await aggregatorService.listProviders()
      ok(
        res,
        rows.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          aggregator: p.aggregator,
          supportedCurrencies: p.supportedCurrencies,
          callbackIpWhitelist: p.callbackIpWhitelist,
          hasCredentials: !!p.credentialsEnc, // never expose the secret itself
          gamesCount: undefined,
        })),
      )
    } catch (e) {
      next(e)
    }
  },

  async adminUpdateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.params.code).toUpperCase() as ProviderCode
      const patch = updateProviderSchema.parse(req.body)
      const row = await aggregatorService.updateProvider(code, patch)
      ok(res, { code: row.code, status: row.status })
    } catch (e) {
      next(e)
    }
  },

  async adminSync(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.params.code).toUpperCase() as ProviderCode
      const count = await aggregatorService.syncGames(code)
      ok(res, { provider: code, synced: count })
    } catch (e) {
      next(e)
    }
  },

  async adminSyncAll(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await aggregatorService.syncAll())
    } catch (e) {
      next(e)
    }
  },

  async adminSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const take = Math.min(Number(req.query.limit ?? 50), 200)
      const rows = await prisma.aggregatorSession.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: { provider: { select: { code: true } }, game: { select: { name: true } }, user: { select: { username: true } } },
      })
      ok(
        res,
        rows.map((s) => ({
          id: s.id,
          user: s.user.username,
          provider: s.provider.code,
          game: s.game?.name ?? null,
          currency: s.currency,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        })),
      )
    } catch (e) {
      next(e)
    }
  },

  async adminProviderTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const take = Math.min(Number(req.query.limit ?? 100), 500)
      const rows = await prisma.providerTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: { provider: { select: { code: true } }, user: { select: { username: true } } },
      })
      ok(
        res,
        rows.map((t) => ({
          id: t.id,
          user: t.user.username,
          provider: t.provider.code,
          type: t.type,
          status: t.status,
          roundId: t.roundId,
          providerTxId: t.providerTxId,
          amountMinor: Number(t.amountMinor),
          balanceAfter: t.balanceAfter != null ? Number(t.balanceAfter) : null,
          createdAt: t.createdAt.toISOString(),
        })),
      )
    } catch (e) {
      next(e)
    }
  },

  async adminCallbacks(req: Request, res: Response, next: NextFunction) {
    try {
      const take = Math.min(Number(req.query.limit ?? 100), 500)
      const status = req.query.status as string | undefined
      const rows = await prisma.callbackLog.findMany({
        where: status ? { status: status as any } : undefined,
        orderBy: { createdAt: 'desc' },
        take,
      })
      ok(res, rows)
    } catch (e) {
      next(e)
    }
  },

  /** Re-run a failed callback through the idempotent processor. */
  async adminRetryCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await prisma.callbackLog.findUnique({ where: { id: String(req.params.id) } })
      if (!log) throw AppError.notFound('Callback not found', 'CALLBACK_NOT_FOUND')

      const code = log.providerCode.toUpperCase() as ProviderCode
      const provider = await aggregatorService.getProviderByCode(code)
      let creds: ProviderCredentials | undefined
      if (provider.credentialsEnc) {
        try {
          creds = decryptJson<ProviderCredentials>(provider.credentialsEnc)
        } catch {
          /* env fallback */
        }
      }
      const adapter = aggregatorFactory.create(code, creds)
      const normalized = adapter.parseCallback(log.payload)
      const result = await callbackService.process(provider, normalized)

      await prisma.callbackLog.update({
        where: { id: log.id },
        data: { status: 'PROCESSED', attempts: { increment: 1 }, response: result as any, error: null },
      })
      ok(res, { retried: true, balanceMinor: result.balanceMinor })
    } catch (e) {
      next(e)
    }
  },
}
