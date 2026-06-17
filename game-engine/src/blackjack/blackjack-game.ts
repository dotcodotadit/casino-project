import { GameCore } from '../core/game-core.js'
import type {
  FairContext,
  Card,
  Rank,
  Suit,
  Hand,
  BlackjackState,
  BlackjackView,
} from '../types.js'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

function freshDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit })
  return deck
}

/** Hand value with soft-ace handling (A counts as 11 unless it busts). */
function evaluate(cards: Card[]): Hand {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 'A') {
      aces++
      total += 11
    } else if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J' || c.rank === '10') {
      total += 10
    } else {
      total += Number(c.rank)
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return {
    cards,
    value: total,
    isBust: total > 21,
    isBlackjack: cards.length === 2 && total === 21,
  }
}

/**
 * Stateful blackjack. The full shoe is shuffled once at deal time from the fair
 * seed, so every subsequent draw is pre-determined and verifiable. State is
 * serialized by the caller into GameRound.outcome between requests.
 *
 * Rules: single deck, dealer stands on all 17 (incl. soft 17), blackjack pays 3:2.
 * Payouts are TOTAL RETURN (stake + winnings) in minor units.
 */
export class BlackjackGame extends GameCore {
  readonly id = 'BLACKJACK' as const
  // Effective RTP for these rules is ~99.5%; declared for transparency.
  readonly rtp = 0.995

  /** Begin a round: shuffle, deal two cards each, detect naturals. */
  deal(stakeMinor: number, ctx: FairContext): BlackjackState {
    const rng = this.rng(ctx)
    const deck = rng.shuffle(freshDeck())
    let cursor = 0
    const player = [deck[cursor++], deck[cursor++]]
    const dealer = [deck[cursor++], deck[cursor++]]

    const state: BlackjackState = {
      deck,
      cursor,
      player,
      dealer,
      stakeMinor,
      status: 'PLAYER_TURN',
    }

    // Resolve naturals immediately.
    const p = evaluate(player)
    const d = evaluate(dealer)
    if (p.isBlackjack || d.isBlackjack) {
      if (p.isBlackjack && d.isBlackjack) state.status = 'PUSH'
      else if (p.isBlackjack) state.status = 'PLAYER_BLACKJACK'
      else state.status = 'DEALER_WIN'
    }
    return state
  }

  /** Player draws one card; busting ends the round. */
  hit(state: BlackjackState): BlackjackState {
    if (state.status !== 'PLAYER_TURN') return state
    const next = { ...state, player: [...state.player, state.deck[state.cursor]], cursor: state.cursor + 1 }
    if (evaluate(next.player).isBust) next.status = 'DEALER_WIN'
    return next
  }

  /** Player stands; dealer plays out and the round resolves. */
  stand(state: BlackjackState): BlackjackState {
    if (state.status !== 'PLAYER_TURN') return state
    const next: BlackjackState = { ...state, status: 'DEALER_TURN', dealer: [...state.dealer] }

    // Dealer draws until 17+ (stands on soft 17).
    while (evaluate(next.dealer).value < 17) {
      next.dealer.push(next.deck[next.cursor++])
    }

    const p = evaluate(next.player).value
    const d = evaluate(next.dealer)
    if (d.isBust || p > d.value) next.status = 'PLAYER_WIN'
    else if (p < d.value) next.status = 'DEALER_WIN'
    else next.status = 'PUSH'
    return next
  }

  /** Total return (minor units) for the resolved status. 0 while in progress. */
  payout(state: BlackjackState): number {
    switch (state.status) {
      case 'PLAYER_BLACKJACK':
        return Math.round(state.stakeMinor * 2.5) // 3:2 + stake
      case 'PLAYER_WIN':
        return state.stakeMinor * 2
      case 'PUSH':
        return state.stakeMinor
      case 'DEALER_WIN':
      default:
        return 0
    }
  }

  /** Whether the round has reached a terminal state. */
  isResolved(state: BlackjackState): boolean {
    return state.status !== 'PLAYER_TURN' && state.status !== 'DEALER_TURN'
  }

  /**
   * Client-safe projection. When `hideHole` is set and the player is still
   * acting, the dealer's second card is omitted so the response never leaks the
   * hole card (a network-savvy player can't read what isn't sent).
   */
  view(state: BlackjackState, hideHole = false): BlackjackView {
    const showHole = !hideHole || state.status !== 'PLAYER_TURN'
    return {
      player: evaluate(state.player),
      dealer: showHole ? evaluate(state.dealer) : evaluate(state.dealer.slice(0, 1)),
      status: state.status,
      canHit: state.status === 'PLAYER_TURN',
      canStand: state.status === 'PLAYER_TURN',
    }
  }
}
