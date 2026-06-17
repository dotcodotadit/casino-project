import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { ProviderError, userFacing } from '../services/aggregators/types.js'
import { logger } from '../lib/logger.js'

function flattenZod(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

/**
 * Centralized error handler. Maps known error types to safe responses and
 * NEVER leaks stack traces or internal detail to the client.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }
  // Aggregator/provider failures → user-friendly message keyed by code.
  if (err instanceof ProviderError) {
    res.status(err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502).json({
      success: false,
      error: { code: err.code, message: userFacing(err.code) },
    })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: flattenZod(err) },
    })
    return
  }
  logger.error({ err, path: req.path }, 'unhandled error')
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
}
