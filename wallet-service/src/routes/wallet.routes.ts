import { Router } from 'express'
import { walletController } from '../controllers/wallet.controller.js'
import { requireAuth, requireWithdrawalEligible } from '../middleware/wallet.middleware.js'
import { validateBody, validateQuery } from '../middleware/validate.middleware.js'
import { walletReadLimiter, moneyMoveLimiter } from '../middleware/rateLimiter.middleware.js'
import { depositSchema, withdrawSchema, transferSchema, historyQuerySchema } from '../types.js'

export const walletRoutes = Router()

// Every wallet route requires a valid Bearer access token.
walletRoutes.use(requireAuth)

// ── Reads ──
walletRoutes.get('/', walletReadLimiter, walletController.getBalances)
walletRoutes.get('/transactions', walletReadLimiter, validateQuery(historyQuerySchema), walletController.transactions)
walletRoutes.get('/transactions/:id', walletReadLimiter, walletController.transactionById)

// ── Money movement (per-user rate limited) ──
walletRoutes.post('/deposit', moneyMoveLimiter, validateBody(depositSchema), walletController.deposit)
walletRoutes.post(
  '/withdraw',
  moneyMoveLimiter,
  validateBody(withdrawSchema),
  requireWithdrawalEligible, // active + FULL KYC gate
  walletController.withdraw,
)
walletRoutes.post('/transfer', moneyMoveLimiter, validateBody(transferSchema), walletController.transfer)
