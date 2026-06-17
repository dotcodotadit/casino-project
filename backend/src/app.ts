import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { config } from './lib/config.js'
import { logger } from './lib/logger.js'
import { apiLimiter } from './middleware/rateLimiter.middleware.js'
import { gatewayContext } from './middleware/gateway.middleware.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'
import { userRoutes } from './routes/user.routes.js'
import { gameRoutes } from './routes/game.routes.js'
import { bonusRoutes } from './routes/bonus.routes.js'
import { loyaltyRoutes } from './routes/loyalty.routes.js'
import { aggregatorRoutes } from './routes/aggregator.routes.js'
import { aggregatorCallbackRoutes } from './routes/aggregator-callback.routes.js'

/**
 * Backend "core" app: user management + Socket.io host. Auth and wallet live in
 * their own services; the api-gateway is the single public ingress and routes to
 * each. This app sits BEHIND the gateway (see gatewayContext) and only verifies
 * access tokens — it never re-implements auth/wallet.
 */
export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors({ origin: config.cors.origins, credentials: true }))
  // Capture the raw body so aggregator callbacks can be HMAC-verified byte-exactly.
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, buf) => {
        ;(req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8')
      },
    }),
  )
  app.use(pinoHttp({ logger }))

  // Gateway pattern: trust/verify the gateway, propagate the request id.
  app.use(gatewayContext)

  app.get('/health', (_req, res) => res.json({ service: 'backend', status: 'ok' }))

  app.use('/api/users', apiLimiter, userRoutes)
  app.use('/api/games', apiLimiter, gameRoutes)
  app.use('/api/bonus', apiLimiter, bonusRoutes)
  app.use('/api/loyalty', apiLimiter, loyaltyRoutes)
  // Provider callbacks FIRST (more specific path) — NOT behind player auth;
  // secured by HMAC signature + IP allowlist instead.
  app.use('/api/aggregator/callback', aggregatorCallbackRoutes)
  app.use('/api/aggregator', apiLimiter, aggregatorRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
