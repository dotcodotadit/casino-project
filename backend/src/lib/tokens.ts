import jwt from 'jsonwebtoken'
import { config } from './config.js'
import type { UserRole } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  role: UserRole
  username: string
}

/** Verify an access token issued by the auth-service (shared secret + issuer). */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtAccessSecret, { issuer: 'casino-auth' }) as AccessTokenPayload
}
