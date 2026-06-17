import { Router } from 'express'
import type { Response } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { serviceRegistry, matchesPrefix, type ServiceDef } from '../config.js'
import { logger } from '../lib/logger.js'

/**
 * Reverse-proxy routes built from the service-discovery registry.
 *
 * IMPORTANT: each proxy uses a FUNCTION pathFilter and is mounted at the router
 * root (not a sub-path) so the FULL `/api/<service>/…` path reaches the upstream
 * — every service self-mounts under `/api/<service>`. (A glob/sub-path mount
 * would strip the prefix; verified the hard way.) The request body is streamed,
 * never parsed, so uploads/JSON pass through untouched.
 */
function buildProxy(svc: ServiceDef) {
  return createProxyMiddleware({
    target: svc.url,
    changeOrigin: true,
    pathFilter: (path: string) => svc.prefixes.some((p) => matchesPrefix(path, p)),
    on: {
      error: (err, _req, res) => {
        logger.error({ err: err.message, service: svc.name, target: svc.url }, 'upstream proxy error')
        const r = res as Response
        if (typeof r.status === 'function' && !r.headersSent) {
          r.status(502).json({
            success: false,
            error: { code: 'BAD_GATEWAY', message: `${svc.name} service unavailable` },
          })
        }
      },
    },
  })
}

export const proxyRoutes = Router()

for (const svc of serviceRegistry) {
  proxyRoutes.use(buildProxy(svc))
  logger.info({ service: svc.name, url: svc.url, prefixes: svc.prefixes }, 'registered upstream')
}
