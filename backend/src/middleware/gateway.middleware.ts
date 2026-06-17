import type { Request, Response, NextFunction } from 'express'
import { config } from '../lib/config.js'
import { AppError } from '../lib/errors.js'

/**
 * Gateway-pattern guard. This service is meant to sit BEHIND the api-gateway.
 *
 * When GATEWAY_SECRET is configured, every /api request must carry the matching
 * `x-gateway-secret` header (stamped by the gateway) — blocking attempts to hit
 * the service directly and bypass gateway auth/rate-limiting. It is opt-in so
 * local/direct development keeps working when the secret is unset.
 *
 * It also propagates the gateway's `x-request-id` onto the response for tracing.
 */
export function gatewayContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id']
  if (typeof requestId === 'string') res.setHeader('x-request-id', requestId)

  if (config.gatewaySecret && req.path.startsWith('/api/')) {
    if (req.headers['x-gateway-secret'] !== config.gatewaySecret) {
      return next(AppError.forbidden('Direct access denied — route via gateway', 'GATEWAY_REQUIRED'))
    }
  }
  next()
}
