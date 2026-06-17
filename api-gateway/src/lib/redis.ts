import Redis from 'ioredis'
import { config } from '../config.js'
import { logger } from './logger.js'

// Shared Redis connection backing the distributed rate limiters, so limits hold
// across multiple gateway instances.
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 })

redis.on('error', (err) => logger.error({ err }, 'gateway redis error'))
redis.on('connect', () => logger.info('gateway redis connected'))
