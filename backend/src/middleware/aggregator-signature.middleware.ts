import type { Request, Response, NextFunction } from 'express'
import type { Provider } from '@prisma/client'
import { aggregatorService } from '../services/aggregators/aggregator.service.js'
import { aggregatorFactory } from '../services/aggregators/aggregator.factory.js'
import { decryptJson } from '../lib/crypto.js'
import { verifyHmac } from '../utils/signature.utils.js'
import { logger } from '../lib/logger.js'
import type { IAggregatorProvider } from '../services/aggregators/aggregator.interface.js'
import type { ProviderCode, ProviderCredentials } from '../services/aggregators/types.js'

// Attach resolved provider context to the request for the controller.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      aggProvider?: Provider
      aggAdapter?: IAggregatorProvider
      rawBody?: string
    }
  }
}

function clientIp(req: Request): string {
  return (req.headers['x-real-ip'] as string) || req.ip || req.socket.remoteAddress || ''
}

/** True if `ip` matches any allowlist entry (exact or simple prefix/CIDR-ish). */
function ipAllowed(ip: string, allow: string[]): boolean {
  if (allow.length === 0) return true // empty = allow all (dev)
  const norm = ip.replace('::ffff:', '')
  return allow.some((entry) => {
    const e = entry.trim()
    if (e.includes('/')) return norm.startsWith(e.split('/')[0].split('.').slice(0, 2).join('.')) // coarse CIDR
    return norm === e || norm.startsWith(e)
  })
}

/**
 * Secures every provider callback:
 *   1. resolves the provider from the :provider route param,
 *   2. enforces the provider's IP allowlist,
 *   3. verifies the HMAC signature (header `x-signature`) over the RAW body.
 * On success attaches `req.aggProvider` + `req.aggAdapter`.
 */
export async function aggregatorSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  const codeParam = String(req.params.provider || '').toUpperCase() as ProviderCode
  const ip = clientIp(req)

  try {
    const provider = await aggregatorService.getProviderByCode(codeParam)

    if (provider.status === 'DISABLED') {
      res.status(403).json({ status: 'ERROR', code: 'PROVIDER_DISABLED' })
      return
    }
    if (!ipAllowed(ip, provider.callbackIpWhitelist)) {
      logger.warn({ provider: codeParam, ip }, 'callback rejected: IP not allowlisted')
      res.status(403).json({ status: 'ERROR', code: 'IP_FORBIDDEN' })
      return
    }

    // Decrypt creds → adapter → callback secret.
    let creds: ProviderCredentials | undefined
    if (provider.credentialsEnc) {
      try {
        creds = decryptJson<ProviderCredentials>(provider.credentialsEnc)
      } catch {
        /* fall back to env creds */
      }
    }
    const adapter = aggregatorFactory.create(codeParam, creds)

    const signature = (req.headers['x-signature'] as string) || (req.headers['x-sign'] as string)
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {})
    if (!verifyHmac(adapter.getCallbackSecret(), rawBody, signature)) {
      logger.warn({ provider: codeParam, ip }, 'callback rejected: bad signature')
      res.status(401).json({ status: 'ERROR', code: 'INVALID_SIGNATURE' })
      return
    }

    req.aggProvider = provider
    req.aggAdapter = adapter
    next()
  } catch (e) {
    logger.warn({ provider: codeParam, ip, err: (e as Error).message }, 'callback rejected: unknown provider')
    res.status(404).json({ status: 'ERROR', code: 'PROVIDER_UNKNOWN' })
  }
}
