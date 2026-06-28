import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

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
    logger.warn(`AppError: ${err.message}`, { path: req.path, method: req.method, code: err.code });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  logger.error(`[UnhandledError] ${req.method} ${req.path}`, { error: err, stack: err.stack, method: req.method, path: req.path });
  
  const details = process.env.NODE_ENV === 'production' ? undefined : (err.stack || err.message || String(err));
  res.status(500).json({ error: 'Internal server error', ...(details && { details }) });
}
