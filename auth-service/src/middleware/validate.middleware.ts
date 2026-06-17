import type { Request, Response, NextFunction } from 'express'
import { ZodError, type ZodSchema } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

/** Validate req.body against a Zod schema; replaces body with the parsed value. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return next(
        AppError.badRequest('Validation failed', 'VALIDATION_ERROR', flatten(parsed.error)),
      )
    }
    req.body = parsed.data
    next()
  }
}

function flatten(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

/** Centralized error handler — maps AppError/ZodError to safe responses. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: flatten(err) },
    })
    return
  }
  // Unknown error — log full detail server-side, return generic message to client.
  logger.error({ err, path: req.path }, 'unhandled error')
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  })
}
