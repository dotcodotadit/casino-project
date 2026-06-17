import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC signature helpers for provider callbacks.
 *
 * Aggregators sign each server-to-server callback so we can prove it genuinely
 * came from them (and wasn't forged/replayed-tampered). We recompute the HMAC
 * over the exact raw body and compare in constant time.
 */

/** HMAC-SHA256(secret, payload) as lowercase hex. */
export function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

/** Constant-time comparison of two signatures (avoids timing oracles). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Verify a provider signature against the raw request body. */
export function verifyHmac(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false
  return safeEqual(hmacSha256(secret, rawBody), signature.toLowerCase())
}

/**
 * Deterministic JSON serialization (sorted keys) — some providers sign a
 * canonical form rather than the raw bytes.
 */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet()
  const sort = (v: any): any => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return v
      seen.add(v)
      if (Array.isArray(v)) return v.map(sort)
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sort(v[k])
          return acc
        }, {})
    }
    return v
  }
  return JSON.stringify(sort(value))
}
