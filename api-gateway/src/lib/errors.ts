/** Typed gateway error mapped to a safe JSON envelope by the error handler. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
  }
  static unauthorized(m = 'Unauthorized', c = 'UNAUTHORIZED') { return new AppError(401, m, c) }
  static forbidden(m = 'Forbidden', c = 'FORBIDDEN') { return new AppError(403, m, c) }
  static tooMany(m = 'Too many requests', c = 'RATE_LIMITED') { return new AppError(429, m, c) }
  static badGateway(m = 'Upstream unavailable', c = 'BAD_GATEWAY') { return new AppError(502, m, c) }
}
