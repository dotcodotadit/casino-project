import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens.js'
import { AppError } from '../lib/errors.js'

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload
    }
  }
}

/** Require a valid Bearer access token. Attaches req.auth. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing access token', 'NO_TOKEN'))
  }
  try {
    req.auth = verifyAccessToken(header.slice(7))
    next()
  } catch {
    next(AppError.unauthorized('Invalid or expired token', 'TOKEN_INVALID'))
  }
}

/** Require a specific role (e.g. ADMIN). Use after requireAuth. */
export function requireRole(...roles: AccessTokenPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(AppError.unauthorized())
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden('Insufficient role', 'FORBIDDEN_ROLE'))
    next()
  }
}
