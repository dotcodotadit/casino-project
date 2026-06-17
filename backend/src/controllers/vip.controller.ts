import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { vipService } from '../services/loyalty/vip.service.js'
import { ok } from '../utils/api.utils.js'

/**
 * VIP controller — player-facing tier reads (ladder, progress, benefits).
 * Mutations (points, level) happen via events/admin, not direct player calls.
 */
export const vipController = {
  /** GET /api/loyalty/vip/levels — the full tier ladder. */
  async levels(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipService.levels())
    } catch (e) {
      next(e)
    }
  },

  /** GET /api/loyalty/vip/me — current progress + benefits + next-tier delta. */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipService.progressFor(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  /** GET /api/loyalty/vip/levels/:id/benefits — resolved benefits for a tier. */
  async levelBenefits(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipService.benefitsForLevel(req.params.id))
    } catch (e) {
      next(e)
    }
  },

  // ── Admin ──
  async adminOverview(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await vipService.adminOverview(req.params.userId))
    } catch (e) {
      next(e)
    }
  },

  async adminSetLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const { level } = z.object({ level: z.number().int().min(0) }).parse(req.body)
      ok(res, await vipService.adminSetLevel(req.params.userId, level, req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },
}
