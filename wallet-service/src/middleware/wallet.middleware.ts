import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens.js'
import { AppError } from '../lib/errors.js'
import { walletService } from '../wallet.service.js'
import { WalletType, Currency } from '@prisma/client'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized('Missing access token', 'NO_TOKEN'))
  try {
    req.auth = verifyAccessToken(header.slice(7))
    next()
  } catch {
    next(AppError.unauthorized('Invalid or expired token', 'TOKEN_INVALID'))
  }
}

/**
 * Balance guard for bet placement. Reads `stake` from body and ensures the
 * MAIN wallet can cover it BEFORE a game round is created. Prevents negative
 * balances at the boundary (the ledger also enforces this atomically).
 */
export function requireSufficientBalance(stakeField = 'stake') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw AppError.unauthorized()
      const stake = Number(req.body?.[stakeField])
      if (!Number.isInteger(stake) || stake <= 0) {
        throw AppError.badRequest('Invalid stake', 'INVALID_STAKE')
      }
      const wallet = await walletService.getWallet(req.auth.sub, WalletType.MAIN, Currency.USD)
      if (wallet.balance < BigInt(stake)) {
        throw AppError.unprocessable('Insufficient balance for this bet', 'INSUFFICIENT_FUNDS')
      }
      next()
    } catch (e) {
      next(e)
    }
  }
}

/** Withdrawal eligibility (active + FULL KYC). */
export async function requireWithdrawalEligible(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw AppError.unauthorized()
    await walletService.assertWithdrawalEligible(req.auth.sub)
    next()
  } catch (e) {
    next(e)
  }
}
