import { GameCore, type InstantGame } from '../core/game-core.js'
import type { FairRng } from '../core/prng.js'
import type {
  FairContext,
  GameRoundResult,
  RouletteOutcome,
  RouletteBet,
  RouletteColor,
  RouletteVariant,
} from '../types.js'

// Standard red pockets on a roulette wheel.
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

function colorOf(pocket: number | '00'): RouletteColor {
  if (pocket === '00' || pocket === 0) return 'green'
  return RED.has(pocket as number) ? 'red' : 'black'
}

export interface RouletteParams {
  variant: RouletteVariant
  bet: RouletteBet
}

/**
 * Single-zero (European, 2.70% edge) and double-zero (American, 5.26% edge)
 * roulette. Payouts are expressed as TOTAL RETURN (stake + winnings) so the
 * ledger simply debits stake then credits `payoutMinor`.
 */
export class RouletteGame extends GameCore implements InstantGame<RouletteParams, RouletteOutcome> {
  readonly id = 'ROULETTE' as const
  // Nominal value; true RTP depends on variant (set on the European baseline).
  readonly rtp = 1 - 1 / 37

  private spinPocket(rng: FairRng, variant: RouletteVariant): number | '00' {
    if (variant === 'AMERICAN') {
      // 38 pockets: 0, 00, 1..36
      const idx = rng.nextInt(38)
      if (idx === 0) return 0
      if (idx === 1) return '00'
      return idx - 1
    }
    // 37 pockets: 0..36
    return rng.nextInt(37)
  }

  /** Total-return multiplier (including stake) if the bet wins, else 0. */
  private evaluate(bet: RouletteBet, pocket: number | '00'): number {
    const color = colorOf(pocket)
    const n = typeof pocket === 'number' ? pocket : -1 // 00 never matches number bets
    const isZero = pocket === 0 || pocket === '00'

    switch (bet.kind) {
      case 'STRAIGHT':
        return bet.number === pocket ? 36 : 0 // 35:1 + stake
      case 'RED':
        return color === 'red' ? 2 : 0
      case 'BLACK':
        return color === 'black' ? 2 : 0
      case 'EVEN':
        return !isZero && n % 2 === 0 ? 2 : 0
      case 'ODD':
        return !isZero && n % 2 === 1 ? 2 : 0
      case 'LOW':
        return !isZero && n >= 1 && n <= 18 ? 2 : 0
      case 'HIGH':
        return !isZero && n >= 19 && n <= 36 ? 2 : 0
      default:
        return 0
    }
  }

  play(stakeMinor: number, params: RouletteParams, ctx: FairContext): GameRoundResult<RouletteOutcome> {
    const rng = this.rng(ctx)
    const pocket = this.spinPocket(rng, params.variant)
    const returnMult = this.evaluate(params.bet, pocket)
    const payoutMinor = Math.round(stakeMinor * returnMult)

    return {
      payoutMinor,
      multiplier: stakeMinor > 0 ? payoutMinor / stakeMinor : 0,
      outcome: { pocket, color: colorOf(pocket) },
    }
  }
}
