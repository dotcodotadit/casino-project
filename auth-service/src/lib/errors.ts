/** Typed application error — controllers map this to HTTP responses without leaking internals. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  static badRequest(msg: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, msg, code, details)
  }
  static unauthorized(msg = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(401, msg, code)
  }
  static forbidden(msg = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(403, msg, code)
  }
  static notFound(msg = 'Not found', code = 'NOT_FOUND') {
    return new AppError(404, msg, code)
  }
  static conflict(msg: string, code = 'CONFLICT') {
    return new AppError(409, msg, code)
  }
  static tooMany(msg = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(429, msg, code)
  }
}
