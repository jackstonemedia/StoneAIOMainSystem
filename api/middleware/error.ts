import { Request, Response, NextFunction } from 'express';

/** Typed application error with HTTP status code */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Central Express error handler — must be registered last */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error(`[UnhandledError] ${req.method} ${req.path}`, err);
  res.status(500).json({ error: 'Internal server error', details: err.stack || err.message || String(err) });
}
