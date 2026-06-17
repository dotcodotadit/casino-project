// Public API of the provably-fair game engine.
export * from './types.js'
export { FairRng, hashServerSeed } from './core/prng.js'
export { GameCore, type InstantGame } from './core/game-core.js'
export { SlotGame } from './slots/slot-game.js'
export { RouletteGame, type RouletteParams } from './roulette/roulette-game.js'
export { BlackjackGame } from './blackjack/blackjack-game.js'

import { SlotGame } from './slots/slot-game.js'
import { RouletteGame } from './roulette/roulette-game.js'
import { BlackjackGame } from './blackjack/blackjack-game.js'

/** Singleton game instances (stateless — safe to share). */
export const games = {
  slots: new SlotGame(),
  roulette: new RouletteGame(),
  blackjack: new BlackjackGame(),
}
