import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { loyaltyService } from '../services/loyalty/loyalty.service.js'
import { pointEngineService } from '../services/loyalty/point-engine.service.js'
import { missionService } from '../services/loyalty/mission.service.js'
import { vipShopService } from '../services/loyalty/vip-shop.service.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

const pageQ = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// ── Admin schemas ──
const moneyToBig = z
  .number()
  .int()
  .optional()
  .transform((v) => (v == null ? undefined : BigInt(v)))

const levelSchema = z.object({
  level: z.number().int().min(0),
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  requiredPoints: moneyToBig,
  keepPoints: moneyToBig,
  pointMultiplier: z.number().min(0).default(1),
  cashbackPct: z.number().min(0).max(100).default(0),
  weeklyBonusMinor: moneyToBig,
  config: z.record(z.unknown()).optional(),
})

const missionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ACHIEVEMENT', 'TIER']),
  metric: z.enum([
    'BET_COUNT',
    'BET_AMOUNT',
    'DEPOSIT_AMOUNT',
    'WIN_AMOUNT',
    'LOGIN_STREAK',
    'GAME_CATEGORY_BETS',
    'POINTS_EARNED',
  ]),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).default('ACTIVE'),
  target: z.number().int().positive(),
  rewardPoints: z.number().int().nonnegative().default(0),
  rewardStatusPoints: z.number().int().nonnegative().default(0),
  rewardBonusId: z.string().optional(),
  minLevelId: z.string().optional(),
  sortOrder: z.number().int().default(0),
  resetHours: z.number().int().positive().optional(),
  params: z.record(z.unknown()).optional(),
})

export const loyaltyController = {
  // ── Player: points ──
  async pointHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const q = pageQ.parse(req.query)
      const type = req.query.type === 'STATUS' || req.query.type === 'LOYALTY' ? req.query.type : undefined
      ok(res, await pointEngineService.history(req.auth!.sub, { type, page: q.page, pageSize: q.pageSize }))
    } catch (e) {
      next(e)
    }
  },

  // ── Player: missions ──
  async missions(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await missionService.listFor(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async claimMission(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await missionService.claim(req.auth!.sub, req.params.id))
    } catch (e) {
      next(e)
    }
  },

  // ── Player: shop ──
  async shop(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipShopService.listFor(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async redeem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.body)
      ok(res, await vipShopService.redeem(req.auth!.sub, itemId), 201)
    } catch (e) {
      next(e)
    }
  },

  async redemptions(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipShopService.historyFor(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: levels ──
  async adminCreateLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = levelSchema.safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid level', 'VALIDATION_ERROR', parsed.error.issues)
      const { config, ...rest } = parsed.data
      ok(res, await loyaltyService.createLevel({ ...rest, config: config as Prisma.InputJsonValue }), 201)
    } catch (e) {
      next(e)
    }
  },

  async adminUpdateLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = levelSchema.partial().safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid level', 'VALIDATION_ERROR', parsed.error.issues)
      const { config, ...rest } = parsed.data
      ok(res, await loyaltyService.updateLevel(req.params.id, { ...rest, ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}) }))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: benefits ──
  async adminBenefits(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await loyaltyService.listBenefits())
    } catch (e) {
      next(e)
    }
  },

  async adminUpsertBenefit(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        id: z.string().optional(),
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum([
          'CASHBACK_PCT',
          'BONUS_BOOST_PCT',
          'WITHDRAWAL_LIMIT',
          'WITHDRAWAL_SPEED',
          'POINT_MULTIPLIER',
          'DEDICATED_MANAGER',
          'BIRTHDAY_GIFT',
          'FREE_WITHDRAWALS',
          'CUSTOM',
        ]),
        unit: z.string().optional(),
      })
      ok(res, await loyaltyService.upsertBenefit(schema.parse(req.body)))
    } catch (e) {
      next(e)
    }
  },

  async adminSetTierBenefit(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        levelId: z.string(),
        benefitId: z.string(),
        value: z.number().default(0),
        valueMinor: z.number().int().optional(),
        enabled: z.boolean().default(true),
      })
      const d = schema.parse(req.body)
      ok(res, await loyaltyService.setTierBenefit(d.levelId, d.benefitId, d.value, d.valueMinor, d.enabled))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: missions ──
  async adminMissions(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await loyaltyService.listMissions({ type: req.query.type as never, status: req.query.status as never }))
    } catch (e) {
      next(e)
    }
  },

  async adminUpsertMission(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = missionSchema.extend({ id: z.string().optional() }).safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid mission', 'VALIDATION_ERROR', parsed.error.issues)
      const { params, ...rest } = parsed.data
      ok(res, await loyaltyService.upsertMission({ ...rest, params: params as Prisma.InputJsonValue }))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: settings ──
  async adminGetSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await loyaltyService.getSettings())
    } catch (e) {
      next(e)
    }
  },

  async adminSetSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value } = z
        .object({ key: z.string(), value: z.record(z.unknown()) })
        .parse(req.body)
      ok(res, await loyaltyService.setSetting(key, value as Prisma.InputJsonValue))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: analytics + adjustment ──
  async adminAnalytics(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await loyaltyService.analytics())
    } catch (e) {
      next(e)
    }
  },

  async adminAdjust(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        userId: z.string(),
        loyaltyDelta: z.number().int().default(0),
        statusDelta: z.number().int().default(0),
        note: z.string().optional(),
      })
      const d = schema.parse(req.body)
      await pointEngineService.adjust(d.userId, d.loyaltyDelta, d.statusDelta, req.auth!.sub, d.note)
      ok(res, { ok: true })
    } catch (e) {
      next(e)
    }
  },

  // ── Admin: shop ──
  async adminUpsertShopItem(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        id: z.string().optional(),
        sku: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        type: z.enum(['FREE_SPINS', 'BONUS_MONEY', 'CASHBACK_BOOST', 'PHYSICAL', 'CUSTOM']),
        costPoints: z.number().int().positive(),
        payload: z.record(z.unknown()).optional(),
        valueMinor: z.number().int().optional(),
        stock: z.number().int().nullable().optional(),
        minLevel: z.number().int().default(0),
        enabled: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      })
      const d = schema.parse(req.body)
      const { id, payload, costPoints, valueMinor, ...rest } = d
      const data = {
        ...rest,
        costPoints: BigInt(costPoints),
        valueMinor: valueMinor != null ? BigInt(valueMinor) : null,
        payload: payload as Prisma.InputJsonValue,
      }
      const { prisma } = await import('../lib/prisma.js')
      const saved = id
        ? await prisma.vipShopItem.update({ where: { id }, data })
        : await prisma.vipShopItem.create({ data })
      ok(res, saved)
    } catch (e) {
      next(e)
    }
  },

  async adminRedemptions(req: Request, res: Response, next: NextFunction) {
    try {
      const q = pageQ.parse(req.query)
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      ok(res, await loyaltyService.adminRedemptions({ ...q, status }))
    } catch (e) {
      next(e)
    }
  },

  async adminFulfilRedemption(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await loyaltyService.fulfilRedemption(req.params.id))
    } catch (e) {
      next(e)
    }
  },
}
