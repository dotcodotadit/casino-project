import type { Request, Response, NextFunction } from 'express'
import { walletService } from '../wallet.service.js'
import { transactionService } from '../transaction.service.js'
import type { HistoryQuery } from '../types.js'

/**
 * HTTP layer for the wallet service. Thin: validation happens in middleware,
 * business rules + atomicity live in the services. Every handler assumes
 * `requireAuth` has populated `req.auth`.
 */
export const walletController = {
  /** GET /api/wallet — all balances for the authenticated user. */
  async getBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await walletService.getWallets(req.auth!.sub)
      res.json({ success: true, data })
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/wallet/deposit — simulated deposit (crypto/bank). */
  async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await walletService.deposit(req.auth!.sub, req.body)
      res.status(201).json({ success: true, data })
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/wallet/withdraw — fee-calculated withdrawal (requires FULL KYC). */
  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await walletService.withdraw(req.auth!.sub, req.body)
      res.status(201).json({ success: true, data })
    } catch (e) {
      next(e)
    }
  },

  /** POST /api/wallet/transfer — internal transfer between own wallets. */
  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await walletService.transfer(req.auth!.sub, req.body)
      res.json({ success: true, data })
    } catch (e) {
      next(e)
    }
  },

  /** GET /api/wallet/transactions — paginated + filterable history. */
  async transactions(req: Request, res: Response, next: NextFunction) {
    try {
      // validateQuery stashes the parsed value here (req.query is read-only in Express 5).
      const query = (req as unknown as { validatedQuery: HistoryQuery }).validatedQuery
      const data = await transactionService.history(req.auth!.sub, query)
      res.json({ success: true, data })
    } catch (e) {
      next(e)
    }
  },

  /** GET /api/wallet/transactions/:id — single transaction (ownership-scoped). */
  async transactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const tx = await transactionService.getById(req.auth!.sub, req.params.id)
      if (!tx) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } })
        return
      }
      res.json({ success: true, data: tx })
    } catch (e) {
      next(e)
    }
  },
}
