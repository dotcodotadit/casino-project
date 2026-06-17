import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { games } from '@casino/game-engine'
import { betService } from '../services/bet.service.js'
import { emitGameResolved } from '../socket/events/game.events.js'
import { bonusBus } from '../events/bonus.events.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

const spinSchema = z.object({ stake: z.number().int().positive() })

export const slotController = {
  /** POST /api/games/slots/spin */
  async spin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = spinSchema.safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid stake', 'VALIDATION_ERROR', parsed.error.issues)

      const result = await betService.resolveInstantBet({
        userId: req.auth!.sub,
        game: 'SLOTS',
        stakeMinor: parsed.data.stake,
        play: (stake, ctx) => games.slots.play(stake, undefined, ctx),
      })

      emitGameResolved(req.auth!.sub, {
        game: 'SLOTS',
        betId: result.betId,
        payout: result.payout,
        balanceAfter: result.balanceAfter,
        outcome: result.outcome,
      })
      // Feed bonus wagering (idempotent per bet id).
      bonusBus.publish('bet.settled', {
        userId: req.auth!.sub,
        stakeMinor: result.stake,
        payoutMinor: result.payout,
        gameCategory: 'SLOTS',
        sourceType: 'GAME_ROUND',
        sourceRef: result.betId,
      })
      ok(res, result, 201)
    } catch (e) {
      next(e)
    }
  },
}
