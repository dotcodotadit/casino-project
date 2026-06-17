import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { slotController } from '../controllers/slot.controller.js'
import { rouletteController } from '../controllers/roulette.controller.js'
import { blackjackController } from '../controllers/blackjack.controller.js'
import { gameController } from '../controllers/game.controller.js'

export const gameRoutes = Router()

// All game actions require authentication.
gameRoutes.use(requireAuth)

// ── Instant games ──
gameRoutes.post('/slots/spin', slotController.spin)
gameRoutes.post('/roulette/spin', rouletteController.spin)

// ── Blackjack (stateful) ──
gameRoutes.post('/blackjack/deal', blackjackController.deal)
gameRoutes.post('/blackjack/hit', blackjackController.hit)
gameRoutes.post('/blackjack/stand', blackjackController.stand)

// ── History + provably-fair ──
gameRoutes.get('/history', gameController.history)
gameRoutes.get('/fairness', gameController.fairness)
gameRoutes.post('/fairness/client-seed', gameController.setClientSeed)
gameRoutes.post('/fairness/rotate', gameController.rotate)
