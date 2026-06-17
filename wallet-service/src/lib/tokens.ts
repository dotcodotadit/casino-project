import jwt from 'jsonwebtoken'
import { config } from './config.js'
import type { UserRole } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  role: UserRole
  username: string
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtAccessSecret, { issuer: 'casino-auth' }) as AccessTokenPayload
}
