import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.headers['x-request-id'],
      },
    });
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: error, requestId: req.headers['x-request-id'] }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      requestId: req.headers['x-request-id'],
    },
  });
}
