import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { games } from '@casino/game-engine'
import { betService } from '../services/bet.service.js'
import { emitGameResolved } from '../socket/events/game.events.js'
import { bonusBus } from '../events/bonus.events.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

const spinSchema = z
  .object({
    stake: z.number().int().positive(),
    variant: z.enum(['EUROPEAN', 'AMERICAN']).default('EUROPEAN'),
    bet: z.object({
      kind: z.enum(['STRAIGHT', 'RED', 'BLACK', 'EVEN', 'ODD', 'LOW', 'HIGH']),
      number: z.number().int().min(0).max(36).optional(),
    }),
  })
  // A straight-up bet must specify a number.
  .refine((d) => d.bet.kind !== 'STRAIGHT' || typeof d.bet.number === 'number', {
    message: 'Straight bet requires a number 0-36',
    path: ['bet', 'number'],
  })

export const rouletteController = {
  /** POST /api/games/roulette/spin */
  async spin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = spinSchema.safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid bet', 'VALIDATION_ERROR', parsed.error.issues)
      const { stake, variant, bet } = parsed.data

      const result = await betService.resolveInstantBet({
        userId: req.auth!.sub,
        game: 'ROULETTE',
        stakeMinor: stake,
        play: (s, ctx) => games.roulette.play(s, { variant, bet }, ctx),
      })

      emitGameResolved(req.auth!.sub, {
        game: 'ROULETTE',
        betId: result.betId,
        payout: result.payout,
        balanceAfter: result.balanceAfter,
        outcome: result.outcome,
      })
      bonusBus.publish('bet.settled', {
        userId: req.auth!.sub,
        stakeMinor: result.stake,
        payoutMinor: result.payout,
        gameCategory: 'TABLE',
        sourceType: 'GAME_ROUND',
        sourceRef: result.betId,
      })
      ok(res, result, 201)
    } catch (e) {
      next(e)
    }
  },
}
