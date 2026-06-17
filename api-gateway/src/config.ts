import 'dotenv/config'

/**
 * API Gateway configuration — the single public ingress for the platform.
 *
 * Responsibilities encoded here:
 *  - service discovery registry (auth / wallet / backend)
 *  - which path prefixes route to which upstream
 *  - which routes are PUBLIC (no JWT required)
 *  - JWT verification secret/issuer (must match auth-service)
 *  - CORS + rate-limit policy
 */

export interface ServiceDef {
  name: string
  url: string
  /** Path prefixes (under /api) that route to this service. */
  prefixes: string[]
  /** Health endpoint for service-discovery health checks. */
  healthPath: string
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.GATEWAY_PORT ?? 8080),

  // ── JWT (verified at the gateway; downstream services re-verify too) ──
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32-chars-min',
    issuer: 'casino-auth',
  },

  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // ── Strict CORS ──
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAgeSeconds: 600,
  },

  // ── Rate limiting (Redis-backed; shared across gateway instances) ──
  rateLimit: {
    global: { windowMs: 60_000, max: 300 }, // all traffic, per IP
    auth: { windowMs: 15 * 60_000, max: 30 }, // login/register brute-force guard
  },

  // Shared secret stamped on every proxied request so upstreams can verify the
  // request actually came through the gateway (set GATEWAY_SECRET to enforce).
  gatewaySecret: process.env.GATEWAY_SECRET ?? '',
} as const

// ── Service discovery registry (static simulation) ──
export const serviceRegistry: ServiceDef[] = [
  {
    name: 'auth',
    url: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001',
    prefixes: ['/api/auth'],
    healthPath: '/health',
  },
  {
    name: 'wallet',
    url: process.env.WALLET_SERVICE_URL ?? 'http://localhost:4002',
    prefixes: ['/api/wallet'],
    healthPath: '/health',
  },
  {
    name: 'backend',
    url: process.env.BACKEND_SERVICE_URL ?? 'http://localhost:4000',
    prefixes: ['/api/games', '/api/users', '/api/aggregator', '/api/bonus', '/api/loyalty'],
    healthPath: '/health',
  },
]

/**
 * PUBLIC routes — reachable without a valid JWT. Everything else under /api
 * requires authentication at the gateway. Matched as exact or prefix (`path/…`).
 */
export const PUBLIC_PATHS: string[] = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  // Provider → platform callbacks carry an HMAC signature, not a player JWT.
  '/api/aggregator/callback',
]

/** True if `path` is exactly `prefix` or starts with `prefix/`. */
export function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

/** Resolve which service should handle a given request path (service discovery). */
export function resolveService(path: string): ServiceDef | null {
  return serviceRegistry.find((svc) => svc.prefixes.some((p) => matchesPrefix(path, p))) ?? null
}

/** Whether a path is public (no JWT required). */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => matchesPrefix(path, p))
}
