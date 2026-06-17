import { Prisma } from '@prisma/client'
import { AppError } from './errors.js'
import { logger } from './logger.js'

/**
 * Retryable conflicts in our ledger:
 *  - P2034: transaction failed due to a write conflict / serialization failure
 *  - P2002: unique constraint violation (e.g. nonce collision under a racing
 *           count() — the retry recomputes a fresh nonce)
 *  - WALLET_CONFLICT: our optimistic-lock version mismatch (AppError)
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2034' || err.code === 'P2002'
  }
  if (err instanceof AppError) return err.code === 'WALLET_CONFLICT'
  // Any error explicitly flagged retriable (e.g. ProviderError WALLET_CONFLICT)
  // or carrying our conflict code.
  const e = err as { retriable?: boolean; code?: string }
  return e?.retriable === true || e?.code === 'WALLET_CONFLICT'
}

/**
 * Run a transactional operation with bounded retries on serialization /
 * optimistic-lock / unique conflicts. Correctness of the Serializable +
 * optimistic-version strategy depends on retrying these — without it,
 * legitimate concurrent bets would just fail.
 */
export async function withRetry<T>(op: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === maxAttempts) throw err
      // Small jittered backoff to spread out colliding writers.
      const backoff = 10 * attempt + Math.floor(Math.random() * 10)
      logger.warn({ attempt, code: (err as { code?: string }).code }, 'retrying conflicted transaction')
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
  throw lastErr
}
