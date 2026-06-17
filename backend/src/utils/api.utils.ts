import type { Response } from 'express'

/**
 * Canonical API envelope used by every service:
 *   success: { success: true, data }
 *   failure: { success: false, error: { code, message, details? } }
 *
 * The frontend `api` client unwraps `.data` from this shape.
 */
export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiFailure {
  success: false
  error: { code: string; message: string; details?: unknown }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data } satisfies ApiSuccess<T>)
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json({ success: false, error: { code, message, details } } satisfies ApiFailure)
}

/** Wrap an async Express handler so thrown errors hit the error middleware. */
export function asyncHandler<T extends (...args: any[]) => Promise<unknown>>(fn: T) {
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next)
}
