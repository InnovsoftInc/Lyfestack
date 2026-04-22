import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export const loggerMiddleware = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] as string,
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
