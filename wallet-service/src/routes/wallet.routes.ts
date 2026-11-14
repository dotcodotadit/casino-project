import { Router } from 'express'
import { walletController } from '../controllers/wallet.controller.js'
import { requireAuth } from '../middleware/wallet.middleware.js'
import { validateQuery } from '../middleware/validate.middleware.js'
import { walletReadLimiter, moneyMoveLimiter } from '../middleware/rateLimiter.middleware.js'
import { historyQuerySchema } from '../types.js'

export const walletRoutes = Router()

// Every wallet route requires a valid Bearer access token.
walletRoutes.use(requireAuth)

// Demo-only build: balances are virtual credits. Never allow simulated cash-in
// or cash-out endpoints to create misleading payment records.
const demoOnlyDisabled = (_req: unknown, res: import('express').Response) =>
  res.status(403).json({
    success: false,
    error: { code: 'DEMO_ONLY', message: 'Deposits and withdrawals are disabled in demo mode. Credits have no cash value.' },
  })

// Reads
walletRoutes.get('/', walletReadLimiter, walletController.getBalances)
walletRoutes.get('/transactions', walletReadLimiter, validateQuery(historyQuerySchema), walletController.transactions)
walletRoutes.get('/transactions/:id', walletReadLimiter, walletController.transactionById)

// Money movement: cash-in and cash-out are explicitly disabled.
// Game bets and game payouts continue to use the internal virtual ledger.
walletRoutes.post('/deposit', moneyMoveLimiter, demoOnlyDisabled)
walletRoutes.post('/withdraw', moneyMoveLimiter, demoOnlyDisabled)
walletRoutes.post('/transfer', moneyMoveLimiter, walletController.transfer)
