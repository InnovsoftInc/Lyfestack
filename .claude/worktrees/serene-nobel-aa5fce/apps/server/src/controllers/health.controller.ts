import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/database';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  let dbHealthy = false;
  try {
    dbHealthy = await checkDatabaseConnection();
  } catch {
    dbHealthy = false;
  }

  const status = dbHealthy ? 'ok' : 'degraded';
  const httpStatus = dbHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'ok' : 'unavailable',
    },
  });
}
