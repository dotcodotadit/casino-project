import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { GameType } from '@prisma/client'
import { betService } from '../services/bet.service.js'
import { gameService } from '../services/game.service.js'
import { ok } from '../utils/api.utils.js'

const historySchema = z.object({
  game: z.enum(['SLOTS', 'ROULETTE', 'BLACKJACK']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const clientSeedSchema = z.object({ clientSeed: z.string().min(1).max(64) })

export const gameController = {
  /** GET /api/games/history?game=&page=&pageSize= */
  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const q = historySchema.parse(req.query)
      ok(res, await betService.history(req.auth!.sub, { game: q.game as GameType | undefined, page: q.page, pageSize: q.pageSize }))
    } catch (e) {
      next(e)
    }
  },

  /** GET /api/games/fairness — current commit + user's client seed. */
  async fairness(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await gameService.getFairness(req.auth!.sub))
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/games/fairness/client-seed — let the player set their seed. */
  async setClientSeed(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientSeed } = clientSeedSchema.parse(req.body)
      const seed = await gameService.setClientSeed(req.auth!.sub, clientSeed)
      ok(res, { clientSeed: seed.seed })
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/games/fairness/rotate — reveal current server seed, issue new commit. */
  async rotate(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await gameService.rotateServerSeed())
    } catch (e) {
      next(e)
    }
  },
}
