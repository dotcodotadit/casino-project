import Redis from 'ioredis'
import { logger } from './logger.js'

// Shared Redis connection for rate limiting, OTP throttling, and session helpers.
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
})

redis.on('error', (err) => logger.error({ err }, 'redis error'))
redis.on('connect', () => logger.info('redis connected'))
