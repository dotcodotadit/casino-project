import pino from 'pino'
import { config } from '../config.js'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  // Never log credentials.
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true },
})
