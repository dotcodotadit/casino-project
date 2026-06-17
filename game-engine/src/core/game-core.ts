import { FairRng } from './prng.js'
import type { FairContext, GameId, GameRoundResult } from '../types.js'

/**
 * Base class for ALL games (instant + stateful). It owns the two things every
 * game shares: deterministic RNG construction from a FairContext, and an
 * explicit, auditable RTP / house edge. Instant games (slots, roulette)
 * additionally implement {@link InstantGame}; stateful games (blackjack)
 * expose their own deal/hit/stand methods.
 */
export abstract class GameCore {
  abstract readonly id: GameId
  /** Theoretical return-to-player as a fraction (e.g. 0.96 = 96%). */
  abstract readonly rtp: number

  /** House edge derived from RTP. */
  get houseEdge(): number {
    return 1 - this.rtp
  }

  /** Build a deterministic RNG for a round. */
  protected rng(ctx: FairContext): FairRng {
    return new FairRng(ctx.serverSeed, ctx.clientSeed, ctx.nonce)
  }
}

/** Single-shot games resolved in one call. */
export interface InstantGame<TParams, TOutcome> {
  play(stakeMinor: number, params: TParams, ctx: FairContext): GameRoundResult<TOutcome>
}
