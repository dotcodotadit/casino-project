import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { games, type BlackjackState } from '@casino/game-engine'
import { betService } from '../services/bet.service.js'
import { emitGameResolved } from '../socket/events/game.events.js'
import { bonusBus } from '../events/bonus.events.js'
import { ok } from '../utils/api.utils.js'
import { AppError } from '../lib/errors.js'

const dealSchema = z.object({ stake: z.number().int().positive() })
const actSchema = z.object({ betId: z.string().min(1) })

const bj = games.blackjack

/** Build the client-facing round state (hole card hidden during PLAYER_TURN). */
function toClient(betId: string, state: BlackjackState, payout: number, balanceAfter: number) {
  const view = bj.view(state, true)
  return {
    betId,
    player: view.player,
    dealer: view.dealer,
    status: view.status,
    payout,
    balanceAfter,
    canHit: view.canHit,
    canStand: view.canStand,
  }
}

export const blackjackController = {
  /** POST /api/games/blackjack/deal */
  async deal(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = dealSchema.safeParse(req.body)
      if (!parsed.success) throw AppError.badRequest('Invalid stake', 'VALIDATION_ERROR', parsed.error.issues)

      const r = await betService.blackjackDeal({
        userId: req.auth!.sub,
        stakeMinor: parsed.data.stake,
        deal: (s, ctx) => bj.deal(s, ctx),
        settlePayout: (s) => bj.payout(s),
        isResolved: (s) => bj.isResolved(s),
      })

      // Stake is committed at deal time → counts toward wagering immediately
      // (idempotent per round id, so replays/actions never double-count).
      bonusBus.publish('bet.settled', {
        userId: req.auth!.sub,
        stakeMinor: parsed.data.stake,
        payoutMinor: r.payout,
        gameCategory: 'TABLE',
        sourceType: 'GAME_ROUND',
        sourceRef: r.betId,
      })

      const payload = toClient(r.betId, r.state, r.payout, r.balanceAfter)
      if (bj.isResolved(r.state)) {
        emitGameResolved(req.auth!.sub, {
          game: 'BLACKJACK',
          betId: r.betId,
          payout: r.payout,
          balanceAfter: r.balanceAfter,
        })
      }
      ok(res, payload, 201)
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/games/blackjack/hit */
  async hit(req: Request, res: Response, next: NextFunction) {
    return act(req, res, next, (s) => bj.hit(s))
  },

  /** POST /api/games/blackjack/stand */
  async stand(req: Request, res: Response, next: NextFunction) {
    return act(req, res, next, (s) => bj.stand(s))
  },
}

async function act(
  req: Request,
  res: Response,
  next: NextFunction,
  advance: (s: BlackjackState) => BlackjackState,
) {
  try {
    const parsed = actSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest('Invalid request', 'VALIDATION_ERROR', parsed.error.issues)

    const r = await betService.blackjackAct({
      userId: req.auth!.sub,
      betId: parsed.data.betId,
      advance,
      settlePayout: (s) => bj.payout(s),
      isResolved: (s) => bj.isResolved(s),
    })

    if (bj.isResolved(r.state)) {
      emitGameResolved(req.auth!.sub, {
        game: 'BLACKJACK',
        betId: r.betId,
        payout: r.payout,
        balanceAfter: r.balanceAfter,
      })
    }
    ok(res, toClient(r.betId, r.state, r.payout, r.balanceAfter))
  } catch (e) {
    next(e)
  }
}
