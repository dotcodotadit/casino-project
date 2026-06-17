import { GameCore, type InstantGame } from '../core/game-core.js'
import type { FairContext, GameRoundResult, SlotsOutcome, SlotsLineWin } from '../types.js'

const REELS = 5
const ROWS = 3

// Symbol reel-weights (higher = more common). Tuned for ~96% RTP.
interface SymbolDef {
  symbol: string
  weight: number
  // payout multipliers for 3, 4, 5 of a kind on a payline (× line bet)
  pays: [number, number, number]
}

const SYMBOLS: SymbolDef[] = [
  { symbol: '🍒', weight: 50, pays: [0.5, 1, 2] },
  { symbol: '🍋', weight: 45, pays: [0.5, 1, 2.5] },
  { symbol: '🔔', weight: 30, pays: [1, 2, 5] },
  { symbol: '⭐', weight: 20, pays: [2, 5, 10] },
  { symbol: '💎', weight: 10, pays: [5, 15, 40] },
  { symbol: '7️⃣', weight: 6, pays: [10, 40, 100] },
]

const SCATTER = '🎁' // not on the weighted reel; injected rarely
const SCATTER_WEIGHT = 4

// 5 fixed paylines over a 5×3 grid (row indices per reel).
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
]

const TOTAL_WEIGHT = SYMBOLS.reduce((s, d) => s + d.weight, 0) + SCATTER_WEIGHT

// Global multiplier on all payouts, calibrated by Monte-Carlo simulation so the
// theoretical RTP lands at ~96% (see slot-game.test / rtp-check). Changing the
// paytable or weights above requires re-calibrating this constant.
const PAY_SCALE = 14.6

export class SlotGame extends GameCore implements InstantGame<void, SlotsOutcome> {
  readonly id = 'SLOTS' as const
  readonly rtp = 0.96

  private pickSymbol(roll: number): string {
    let acc = 0
    for (const def of SYMBOLS) {
      acc += def.weight
      if (roll < acc) return def.symbol
    }
    return SCATTER // remaining weight → scatter
  }

  private payTable(symbol: string): SymbolDef['pays'] | null {
    return SYMBOLS.find((s) => s.symbol === symbol)?.pays ?? null
  }

  play(stakeMinor: number, _params: void, ctx: FairContext): GameRoundResult<SlotsOutcome> {
    const rng = this.rng(ctx)

    // Build the 5×3 grid.
    const reels: string[][] = []
    for (let r = 0; r < REELS; r++) {
      const col: string[] = []
      for (let row = 0; row < ROWS; row++) {
        col.push(this.pickSymbol(rng.nextInt(TOTAL_WEIGHT)))
      }
      reels.push(col)
    }

    // Line bet = stake spread across paylines.
    const lineBet = stakeMinor / PAYLINES.length

    // Evaluate paylines: leftmost-consecutive matches (3+).
    const lines: SlotsLineWin[] = []
    PAYLINES.forEach((pattern, index) => {
      const first = reels[0][pattern[0]]
      if (first === SCATTER) return
      let count = 1
      for (let r = 1; r < REELS; r++) {
        if (reels[r][pattern[r]] === first) count++
        else break
      }
      if (count >= 3) {
        const pays = this.payTable(first)
        if (!pays) return
        const mult = pays[count - 3]
        const payout = Math.round(lineBet * mult * PAY_SCALE)
        if (payout > 0) lines.push({ index, symbol: first, count, payout })
      }
    })

    // Scatters anywhere → free spins / bonus (paid as a flat scatter bonus here).
    let scatterCount = 0
    for (const col of reels) for (const s of col) if (s === SCATTER) scatterCount++
    const bonusTriggered = scatterCount >= 3
    const freeSpinsAwarded = bonusTriggered ? 5 + (scatterCount - 3) * 5 : 0
    const scatterPayout = bonusTriggered ? Math.round(stakeMinor * scatterCount * PAY_SCALE) : 0

    const linePayout = lines.reduce((s, l) => s + l.payout, 0)
    const payoutMinor = linePayout + scatterPayout

    return {
      payoutMinor,
      multiplier: stakeMinor > 0 ? payoutMinor / stakeMinor : 0,
      outcome: { reels, lines, freeSpinsAwarded, bonusTriggered },
    }
  }
}
