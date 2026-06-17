import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

/** Standard security headers. */
export const securityHeaders = helmet()

/**
 * Strict CORS: only the configured origins, credentials allowed, explicit
 * methods/headers, preflight cached. A disallowed origin is rejected (not
 * silently passed without CORS headers).
 */
export const corsPolicy = cors({
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header) e.g. server-to-server / curl.
    if (!origin || config.cors.origins.includes(origin)) return callback(null, true)
    callback(new AppError(403, 'Origin not allowed', 'CORS_FORBIDDEN'))
  },
  credentials: true,
  methods: [...config.cors.methods],
  allowedHeaders: [...config.cors.allowedHeaders],
  maxAge: config.cors.maxAgeSeconds,
})

/**
 * Establish a trusted request context:
 *  - assign/propagate an `x-request-id` for tracing,
 *  - STRIP any client-supplied identity/trust headers so they can't be spoofed
 *    (the gateway is the sole authority for these),
 *  - stamp the gateway shared secret for upstream verification.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID()
  req.headers['x-request-id'] = requestId
  res.setHeader('x-request-id', requestId)

  // Anti-spoofing: clients must never set these — only the gateway may.
  delete req.headers['x-user-id']
  delete req.headers['x-user-role']
  delete req.headers['x-user-name']
  delete req.headers['x-gateway-secret']

  if (config.gatewaySecret) {
    req.headers['x-gateway-secret'] = config.gatewaySecret
  }

  next()
}
