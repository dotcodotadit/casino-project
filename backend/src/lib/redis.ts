import Redis from 'ioredis'
import { config } from './config.js'
import { logger } from './logger.js'

/**
 * Two connections: a normal client and a dedicated subscriber.
 * ioredis requires a separate connection for SUBSCRIBE mode (a subscribed
 * connection cannot issue normal commands).
 */
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 })
export const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 })

redis.on('error', (err) => logger.error({ err }, 'redis error'))
redisSub.on('error', (err) => logger.error({ err }, 'redis sub error'))
