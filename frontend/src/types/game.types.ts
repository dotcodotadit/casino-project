// Game types mirroring the backend / game-engine outputs.

export type GameType = 'SLOTS' | 'ROULETTE' | 'BLACKJACK'

export interface Fairness {
  serverSeedHash: string
  clientSeed: string
  nonce: number
}

/** Common envelope for an instant bet result (slots / roulette). */
export interface InstantBetResult<O> {
  betId: string
  game: GameType
  stake: number
  payout: number
  multiplier: number
  balanceAfter: number
  fairness: Fairness
  outcome: O
}

// ── Slots ──
export interface SlotsLineWin {
  index: number
  symbol: string
  count: number
  payout: number
}
export interface SlotsOutcome {
  reels: string[][]
  lines: SlotsLineWin[]
  freeSpinsAwarded: number
  bonusTriggered: boolean
}
export type SlotsResult = InstantBetResult<SlotsOutcome>

// ── Roulette ──
export type RouletteVariant = 'EUROPEAN' | 'AMERICAN'
export type RouletteBetKind = 'STRAIGHT' | 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'LOW' | 'HIGH'
export interface RouletteOutcome {
  pocket: number | '00'
  color: 'red' | 'black' | 'green'
}
export type RouletteResult = InstantBetResult<RouletteOutcome>

// ── Blackjack ──
export interface Card {
  rank: string
  suit: string
}
export interface Hand {
  cards: Card[]
  value: number
  isBust: boolean
  isBlackjack: boolean
}
export type BlackjackStatus =
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'PLAYER_WIN'
  | 'DEALER_WIN'
  | 'PUSH'
  | 'PLAYER_BLACKJACK'
export interface BlackjackState {
  betId: string
  player: Hand
  dealer: Hand
  status: BlackjackStatus
  payout: number
  balanceAfter: number
  canHit: boolean
  canStand: boolean
}

// ── History ──
export interface BetHistoryItem {
  id: string
  game: GameType
  stake: number
  payout: number
  nonce: number
  createdAt: string
}
export interface PaginatedBets {
  items: BetHistoryItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface FairnessInfo {
  serverSeedHash: string
  clientSeed: string
  nextNonce: number
}
