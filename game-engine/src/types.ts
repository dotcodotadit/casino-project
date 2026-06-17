// Shared types for the provably-fair game engine.
// The engine is pure (no DB / framework deps) so it can be unit-tested and
// reused by the backend and by client-side verifiers.

export type GameId = 'SLOTS' | 'ROULETTE' | 'BLACKJACK'

/** The three inputs that fully determine a provably-fair outcome. */
export interface FairContext {
  serverSeed: string // raw seed (secret until rotation)
  clientSeed: string
  nonce: number
}

/** Result of resolving a single instant round (slots / roulette). */
export interface GameRoundResult<O> {
  /** Total amount returned to the player in MINOR units (stake + winnings on a win, 0 on a loss). */
  payoutMinor: number
  /** payoutMinor / stakeMinor — for display/analytics. */
  multiplier: number
  /** Game-specific outcome payload (sent to the client + persisted). */
  outcome: O
}

// ── Slots ──
export interface SlotsLineWin {
  index: number
  symbol: string
  count: number
  payout: number // minor units credited for this line
}
export interface SlotsOutcome {
  reels: string[][] // [reel][row]
  lines: SlotsLineWin[]
  freeSpinsAwarded: number
  bonusTriggered: boolean
}

// ── Roulette ──
export type RouletteVariant = 'EUROPEAN' | 'AMERICAN'
export type RouletteColor = 'red' | 'black' | 'green'
export type RouletteBetKind = 'STRAIGHT' | 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'LOW' | 'HIGH'
export interface RouletteBet {
  kind: RouletteBetKind
  number?: number // required for STRAIGHT
}
export interface RouletteOutcome {
  pocket: number | '00'
  color: RouletteColor
}

// ── Blackjack ──
export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export interface Card {
  rank: Rank
  suit: Suit
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

/** Persisted blackjack round state (stored in GameRound.outcome). */
export interface BlackjackState {
  deck: Card[] // full shuffled shoe (determined by the seed at deal time)
  cursor: number // index of next card to draw
  player: Card[]
  dealer: Card[]
  status: BlackjackStatus
  stakeMinor: number
}

/** Public projection of a blackjack round (sent to the client). */
export interface BlackjackView {
  player: Hand
  dealer: Hand
  status: BlackjackStatus
  canHit: boolean
  canStand: boolean
}
