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
  static badRequest(m: string, c = 'BAD_REQUEST', d?: unknown) { return new AppError(400, m, c, d) }
  static unauthorized(m = 'Unauthorized', c = 'UNAUTHORIZED') { return new AppError(401, m, c) }
  static forbidden(m = 'Forbidden', c = 'FORBIDDEN') { return new AppError(403, m, c) }
  static notFound(m = 'Not found', c = 'NOT_FOUND') { return new AppError(404, m, c) }
  static conflict(m: string, c = 'CONFLICT') { return new AppError(409, m, c) }
  static unprocessable(m: string, c = 'UNPROCESSABLE') { return new AppError(422, m, c) }
}
