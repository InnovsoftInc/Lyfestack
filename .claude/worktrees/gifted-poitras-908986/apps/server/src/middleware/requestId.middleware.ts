import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
