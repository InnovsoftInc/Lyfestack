import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/config';
import { AuthenticationError } from '../errors/AppError';

export interface AuthRequest extends Request {
  userId: string;
  userEmail: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing bearer token'));
  }

  const token = authHeader.slice(7);

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    return next(new AuthenticationError('Auth not configured'));
  }

  const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return next(new AuthenticationError('Invalid or expired token'));
  }

  (req as AuthRequest).userId = data.user.id;
  (req as AuthRequest).userEmail = data.user.email ?? '';
  next();
}
