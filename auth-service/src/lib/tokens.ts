import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'node:crypto'
import { config } from './config.js'
import type { UserRole } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string // user id
  role: UserRole
  username: string
}

/** Sign a short-lived access token (default 15m). */
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = {
    // accessTtl is a duration string ('15m'); cast for @types/jsonwebtoken's StringValue.
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'],
    issuer: 'casino-auth',
  }
  return jwt.sign(payload, config.jwt.accessSecret, options)
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: 'casino-auth' }) as AccessTokenPayload
}

/**
 * Refresh tokens are opaque random strings (not JWTs) so they can be revoked
 * server-side. We store only their SHA-256 hash.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Simple, privacy-preserving device fingerprint. */
export function deviceFingerprint(userAgent = '', ip = '', acceptLang = ''): string {
  return createHash('sha256').update(`${userAgent}|${ip}|${acceptLang}`).digest('hex').slice(0, 32)
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000)
}
