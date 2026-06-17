import { Router } from 'express'
import { aggregatorCallbackController } from '../controllers/aggregator-callback.controller.js'
import { aggregatorSignature } from '../middleware/aggregator-signature.middleware.js'
import { aggregatorCallbackLimiter } from '../middleware/rateLimiter.middleware.js'

/**
 * Provider → platform callbacks. Mounted at /api/aggregator/callback.
 * Public (no player JWT) but protected by: dedicated rate limiter → HMAC
 * signature + IP allowlist (aggregatorSignature) → handler.
 */
export const aggregatorCallbackRoutes = Router()

aggregatorCallbackRoutes.post('/:provider', aggregatorCallbackLimiter, aggregatorSignature, aggregatorCallbackController.handle)
