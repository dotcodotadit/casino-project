// Barrel module — single source of truth re-exports.
// New code should import from '@/types/user.types' or '@/types/wallet.types'.
export * from './user.types'
export * from './wallet.types'

export type GameType = 'SLOTS' | 'ROULETTE' | 'BLACKJACK'

/** Result returned by a game round (provably-fair). */
export interface BetResult {
  betId: string
  game: GameType
  stake: number
  payout: number
  balanceAfter: number
  fairness: {
    serverSeedHash: string
    clientSeed: string
    nonce: number
  }
  outcome: unknown
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}
