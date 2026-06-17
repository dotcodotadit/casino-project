import express, { type Request, type Response, type NextFunction } from 'express'
import pinoHttp from 'pino-http'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { AppError } from './lib/errors.js'
import { startHealthChecks, getServiceHealth } from './lib/discovery.js'
import { securityHeaders, corsPolicy, requestContext } from './middleware/security.middleware.js'
import { globalLimiter, authLimiter } from './middleware/rate-limit.gateway.js'
import { gatewayAuth } from './middleware/auth.gateway.js'
import { proxyRoutes } from './routes/proxy.routes.js'

const app = express()
// Behind a load balancer in prod; trust the first proxy hop for real client IPs.
app.set('trust proxy', 1)
app.disable('x-powered-by')

// ── 1. Security + request context (headers, CORS, request-id, anti-spoofing) ──
app.use(securityHeaders)
app.use(corsPolicy)
app.use(requestContext)

// ── 2. Request logging (correlated by x-request-id) ──
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
  }),
)

// ── 3. Health/observability (no auth, no rate limit) ──
app.get('/health', (_req, res) =>
  res.json({ service: 'gateway', status: 'ok', upstreams: getServiceHealth() }),
)

// ── 4. Rate limiting: strict on auth endpoints, global on everything else ──
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use(globalLimiter)

// ── 5. JWT validation at the gateway (public routes excepted) ──
app.use(gatewayAuth)

// ── 6. Service-discovery reverse proxy (body streamed, path preserved) ──
app.use(proxyRoutes)

// ── 7. 404 for anything not matched by a known upstream ──
app.use((_req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown gateway route' } }),
)

// ── 8. Centralized error handler — single, safe JSON envelope ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } })
    return
  }
  logger.error({ err, path: req.path }, 'unhandled gateway error')
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Gateway error' } })
})

app.listen(config.port, () => {
  logger.info(`api-gateway listening on :${config.port}`)
  startHealthChecks()
})
