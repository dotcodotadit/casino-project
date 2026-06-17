import Redis from 'ioredis'
import { logger } from './logger.js'

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => logger.error({ err }, 'redis error'))
