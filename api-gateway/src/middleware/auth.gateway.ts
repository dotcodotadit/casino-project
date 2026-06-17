import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config, isPublicPath } from '../config.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

interface AccessTokenPayload {
  sub: string
  role: string
  username: string
}

/**
 * Gateway-level JWT validation.
 *
 * - PUBLIC paths (login/register/refresh/logout) pass through untouched.
 * - All other /api routes require a valid Bearer access token; invalid/missing
 *   tokens are rejected HERE, before any upstream is touched (fail fast).
 * - On success, trusted identity is injected as `x-user-*` headers for upstreams.
 *   Downstream services STILL re-verify the JWT — this is defense in depth, and
 *   the header injection is purely informational/observability.
 *
 * Note: client-supplied x-user-* headers were already stripped in
 * requestContext, so these cannot be spoofed.
 */
export function gatewayAuth(req: Request, _res: Response, next: NextFunction): void {
  // Only guard API routes; let non-API (e.g. health) through.
  if (!req.path.startsWith('/api/')) return next()
  if (isPublicPath(req.path)) return next()

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing access token', 'NO_TOKEN'))
  }

  try {
    const payload = jwt.verify(header.slice(7), config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
    }) as AccessTokenPayload

    req.headers['x-user-id'] = payload.sub
    req.headers['x-user-role'] = payload.role
    req.headers['x-user-name'] = encodeURIComponent(payload.username)
    next()
  } catch {
    logger.debug({ path: req.path }, 'gateway rejected invalid token')
    next(AppError.unauthorized('Invalid or expired token', 'TOKEN_INVALID'))
  }
}
