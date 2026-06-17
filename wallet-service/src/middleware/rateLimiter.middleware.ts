import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import type { Request } from 'express'
import { redis } from '../lib/redis.js'

/**
 * Redis-backed limiters so limits hold across multiple wallet-service instances.
 * Money-movement endpoints are limited PER USER (not just per IP) to stop a
 * single authenticated account from hammering deposit/withdraw.
 */
function makeLimiter(opts: {
  windowMs: number
  max: number
  prefix: string
  perUser?: boolean
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    // When perUser, key on the authenticated subject; fall back to IP.
    keyGenerator: opts.perUser
      ? (req: Request) => req.auth?.sub ?? req.ip ?? 'anon'
      : undefined,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<any>,
      prefix: `rl:${opts.prefix}:`,
    }),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
}

// Read-only wallet/balance/history reads — generous, per IP.
export const walletReadLimiter = makeLimiter({ windowMs: 60_000, max: 120, prefix: 'wallet_read' })

// Money movement — strict, PER USER.
export const moneyMoveLimiter = makeLimiter({
  windowMs: 60_000,
  max: 20,
  prefix: 'wallet_move',
  perUser: true,
})
