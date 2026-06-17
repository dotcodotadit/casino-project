import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../lib/redis.js'

// Redis-backed limiter so limits hold across multiple instances.
function makeLimiter(opts: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // ioredis call signature
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<any>,
      prefix: `rl:${opts.prefix}:`,
    }),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
}

// Strict limiter for auth endpoints (login/register/refresh) — per IP.
export const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 30, prefix: 'auth' })

// Very strict for OTP requests.
export const otpLimiter = makeLimiter({ windowMs: 10 * 60 * 1000, max: 5, prefix: 'otp' })

// General API limiter.
export const apiLimiter = makeLimiter({ windowMs: 60 * 1000, max: 120, prefix: 'api' })
