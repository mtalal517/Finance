/**
 * Errors the user is allowed to see.
 *
 * Anything thrown as an `AppError` carries a message written for a person and a
 * sensible HTTP status. Everything else is treated as a bug: it is logged on the
 * server and the client is told something generic, so a stack trace or a file
 * path never reaches the browser.
 */
export class AppError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status = 400, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function notFound(message = 'That item could not be found.'): AppError {
  return new AppError(message, 404);
}

export function badRequest(message: string, fieldErrors: Record<string, string> = {}): AppError {
  return new AppError(message, 400, fieldErrors);
}

export function conflict(message: string): AppError {
  return new AppError(message, 409);
}
