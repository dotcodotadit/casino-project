import { serviceRegistry } from '../config.js'
import { logger } from './logger.js'

/**
 * Service-discovery health monitoring (simulation).
 *
 * A real platform would use Consul/etcd/Kubernetes for dynamic discovery + health.
 * Here the registry is static, but we actively poll each upstream's /health so the
 * gateway logs degraded services. The live status map could later drive routing
 * decisions (e.g. fail fast / circuit-break) instead of just observability.
 */
const status = new Map<string, 'up' | 'down' | 'unknown'>()

export function getServiceHealth(): Record<string, string> {
  return Object.fromEntries(serviceRegistry.map((s) => [s.name, status.get(s.name) ?? 'unknown']))
}

async function pingOnce(): Promise<void> {
  await Promise.all(
    serviceRegistry.map(async (svc) => {
      const prev = status.get(svc.name)
      try {
        const res = await fetch(`${svc.url}${svc.healthPath}`, {
          signal: AbortSignal.timeout(3000),
        })
        const next = res.ok ? 'up' : 'down'
        status.set(svc.name, next)
        if (prev && prev !== next) logger.warn({ service: svc.name, from: prev, to: next }, 'service health changed')
      } catch {
        status.set(svc.name, 'down')
        if (prev !== 'down') logger.warn({ service: svc.name }, 'service unreachable')
      }
    }),
  )
}

/** Begin periodic health checks. Returns a stop function. */
export function startHealthChecks(intervalMs = 15_000): () => void {
  void pingOnce()
  const handle = setInterval(() => void pingOnce(), intervalMs)
  return () => clearInterval(handle)
}
