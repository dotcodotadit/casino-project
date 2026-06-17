import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../lib/redis.js'
import { config } from '../config.js'

/**
 * Redis-backed limiter factory. Distributed counters mean limits hold across
 * every gateway instance, not just the local process.
 */
function makeLimiter(opts: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<any>,
      prefix: `rl:gw:${opts.prefix}:`,
    }),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
}

/** Global limiter applied to every request (per IP). */
export const globalLimiter = makeLimiter({ ...config.rateLimit.global, prefix: 'global' })

/** Stricter limiter for auth endpoints (brute-force protection). */
export const authLimiter = makeLimiter({ ...config.rateLimit.auth, prefix: 'auth' })
