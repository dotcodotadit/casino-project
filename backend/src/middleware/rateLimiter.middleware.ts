import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../lib/redis.js'

function makeLimiter(opts: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<any>,
      prefix: `rl:${opts.prefix}:`,
    }),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
}

/** General API limiter for backend routes (per IP). */
export const apiLimiter = makeLimiter({ windowMs: 60_000, max: 120, prefix: 'be_api' })

/**
 * Dedicated limiter for provider callbacks. Providers can burst many tx/sec for
 * busy tables, so the ceiling is high — it exists to blunt abuse from a spoofed
 * source, not to throttle legitimate traffic.
 */
export const aggregatorCallbackLimiter = makeLimiter({ windowMs: 1_000, max: 50, prefix: 'agg_cb' })
