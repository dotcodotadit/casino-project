import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { bonusService } from '../services/bonus/bonus.service.js'
import { conditionsService } from '../services/bonus/conditions.service.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

// Client device fingerprint header (set by the frontend) — used for abuse checks.
const clientCtx = (req: Request) => ({
  ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip,
  deviceFingerprint: req.headers['x-device-id'] as string | undefined,
})

const claimSchema = z.object({ bonusId: z.string().optional(), code: z.string().min(1).max(64).optional() })
const historyQ = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  bonusId: z.string().optional(),
})

// ── Admin bonus payload (kept permissive; engine validates semantics) ──
const moneyToBigInt = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .transform((v) => (v == null ? undefined : BigInt(v)))

const bonusBodySchema = z.object({
  code: z.string().max(64).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['WELCOME', 'DEPOSIT', 'RELOAD', 'FREE_SPIN', 'CASHBACK', 'LOYALTY', 'NO_DEPOSIT', 'MANUAL']),
  rewardType: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SPINS']),
  claimMode: z.enum(['AUTO', 'MANUAL', 'CODE']).default('AUTO'),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED']).default('DRAFT'),
  percentage: z.number().min(0).max(100).optional(),
  fixedAmountMinor: moneyToBigInt,
  maxAmountMinor: moneyToBigInt,
  minDepositMinor: moneyToBigInt,
  freeSpinCount: z.number().int().nonnegative().optional(),
  freeSpinValueMinor: moneyToBigInt,
  freeSpinGameId: z.string().optional(),
  wagerMultiplier: z.number().min(0).max(100).default(0),
  wagerIncludesDeposit: z.boolean().default(false),
  maxBetMinor: moneyToBigInt,
  expiryHours: z.number().int().positive().default(168),
  cashbackBasis: z.enum(['NET_LOSS', 'DEPOSIT']).optional(),
  cashbackPeriodHours: z.number().int().positive().optional(),
  allowStacking: z.boolean().default(false),
  priority: z.number().int().default(0),
  maxClaimsPerUser: z.number().int().positive().default(1),
  maxClaimsTotal: z.number().int().positive().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  config: z.record(z.unknown()).optional(),
})

const conditionsSchema = z.object({
  conditions: z.array(
    z.object({
      type: z.enum([
        'MIN_DEPOSIT',
        'MIN_KYC_LEVEL',
        'COUNTRY_ALLOW',
        'COUNTRY_DENY',
        'NEW_USERS_ONLY',
        'FIRST_DEPOSIT_ONLY',
        'MIN_ACCOUNT_AGE_HOURS',
        'GAME_CATEGORY',
        'CUSTOM',
      ]),
      operator: z.string().optional(),
      value: z.string(),
      params: z.record(z.unknown()).optional(),
    }),
  ),
})

export const bonusController = {
  // ── Player ──
  async available(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.availableFor(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async mine(req: Request, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      ok(res, await bonusService.myBonuses(req.auth!.sub, status))
    } catch (e) {
      next(e)
    }
  },

  async progress(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.wageringProgress(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async claim(req: Request, res: Response, next: NextFunction) {
    try {
      const body = claimSchema.parse(req.body)
      const view = await bonusService.claim(req.auth!.sub, { ...body, ...clientCtx(req) })
      ok(res, view, 201)
    } catch (e) {
      next(e)
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.cancel(req.auth!.sub, req.params.id))
    } catch (e) {
      next(e)
    }
  },

  async freeSpins(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.freeSpins(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async promotions(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.listPromotions(true))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin ──
  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const kind = req.query.kind as never
      const status = req.query.status as never
      ok(res, await bonusService.listBonuses({ kind, status }))
    } catch (e) {
      next(e)
    }
  },

  async adminGet(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.getBonus(req.params.id))
    } catch (e) {
      next(e)
    }
  },

  async adminCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bonusBodySchema.safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid bonus', 'VALIDATION_ERROR', parsed.error.issues)
      const { config, ...rest } = parsed.data
      const created = await bonusService.createBonus({
        ...rest,
        createdBy: req.auth!.sub,
        config: config as Prisma.InputJsonValue,
      })
      ok(res, created, 201)
    } catch (e) {
      next(e)
    }
  },

  async adminUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bonusBodySchema.partial().safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid bonus', 'VALIDATION_ERROR', parsed.error.issues)
      const { config, ...rest } = parsed.data
      const updated = await bonusService.updateBonus(
        req.params.id,
        { ...rest, ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}) },
        req.auth!.sub,
      )
      ok(res, updated)
    } catch (e) {
      next(e)
    }
  },

  async adminSetStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = z
        .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'])
        .parse(req.body?.status)
      ok(res, await bonusService.setStatus(req.params.id, status, req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async adminSetConditions(req: Request, res: Response, next: NextFunction) {
    try {
      const { conditions } = conditionsSchema.parse(req.body)
      ok(
        res,
        await bonusService.setConditions(
          req.params.id,
          conditions.map((c) => ({ ...c, params: c.params as Prisma.InputJsonValue })),
        ),
      )
    } catch (e) {
      next(e)
    }
  },

  async adminGrant(req: Request, res: Response, next: NextFunction) {
    try {
      const body = z.object({ userId: z.string(), triggerAmountMinor: z.number().int().nonnegative().optional() }).parse(req.body)
      ok(res, await bonusService.adminGrant(req.params.id, body.userId, req.auth!.sub, body.triggerAmountMinor), 201)
    } catch (e) {
      next(e)
    }
  },

  async adminCancelUserBonus(req: Request, res: Response, next: NextFunction) {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'admin_cancelled'
      ok(res, await bonusService.adminCancel(req.params.id, reason))
    } catch (e) {
      next(e)
    }
  },

  async adminHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const q = historyQ.parse(req.query)
      ok(res, await bonusService.claimHistory(q))
    } catch (e) {
      next(e)
    }
  },

  async adminAnalytics(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.analytics())
    } catch (e) {
      next(e)
    }
  },

  async adminAbuseFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = req.query.resolved === 'true'
      ok(res, await bonusService.abuseFlags(resolved))
    } catch (e) {
      next(e)
    }
  },

  async adminResolveAbuse(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.resolveAbuseFlag(req.params.id))
    } catch (e) {
      next(e)
    }
  },

  async adminPromotions(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await bonusService.listPromotions(false))
    } catch (e) {
      next(e)
    }
  },

  async adminUpsertPromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        id: z.string().optional(),
        slug: z.string().min(1),
        title: z.string().min(1),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        bannerUrl: z.string().optional(),
        bonusId: z.string().optional(),
        status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'ARCHIVED']).default('DRAFT'),
        sortOrder: z.number().int().default(0),
        content: z.record(z.unknown()).optional(),
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().optional(),
      })
      const data = schema.parse(req.body)
      ok(res, await bonusService.upsertPromotion({ ...data, content: data.content as Prisma.InputJsonValue }))
    } catch (e) {
      next(e)
    }
  },

  // ── Hot-reloadable settings (no redeploy) ──
  async adminGetSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, {
        abuse: await conditionsService.abuseSettings(),
        global: await conditionsService.globalSettings(),
        categoryWeights: await conditionsService.categoryWeights(),
      })
    } catch (e) {
      next(e)
    }
  },

  async adminSetSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value } = z.object({ key: z.string(), value: z.record(z.unknown()).or(z.array(z.unknown())) }).parse(req.body)
      const { prisma } = await import('../lib/prisma.js')
      const saved = await prisma.bonusSetting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
      })
      conditionsService.invalidateSettings(key)
      ok(res, saved)
    } catch (e) {
      next(e)
    }
  },
}
