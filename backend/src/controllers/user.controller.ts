import type { Request, Response, NextFunction } from 'express'
import { userService, updateProfileSchema } from '../services/user.service.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

export const userController = {
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await userService.getProfile(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateProfileSchema.safeParse(req.body)
      if (!parsed.success) {
        throw AppError.badRequest('Validation failed', 'VALIDATION_ERROR', parsed.error.issues)
      }
      ok(res, await userService.updateProfile(req.auth!.sub, parsed.data))
    } catch (e) {
      next(e)
    }
  },

  async selfExclude(req: Request, res: Response, next: NextFunction) {
    try {
      await userService.selfExclude(req.auth!.sub)
      ok(res, { selfExcluded: true })
    } catch (e) {
      next(e)
    }
  },
}
