import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticationError } from '../errors/AppError';

export interface UserContext {
  id: string;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function createAuthMiddleware(supabase: SupabaseClient) {
  return async function requireAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = extractBearerToken(req);
    if (!token) {
      return next(new AuthenticationError('No authentication token provided', 'AUTHENTICATION_REQUIRED'));
    }

    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('expired') || msg.includes('jwt expired')) {
          return next(new AuthenticationError('Token has expired', 'TOKEN_EXPIRED'));
        }
        return next(new AuthenticationError('Invalid authentication token', 'INVALID_TOKEN'));
      }

      if (!data.user) {
        return next(new AuthenticationError('Invalid authentication token', 'INVALID_TOKEN'));
      }

      req.user = {
        id: data.user.id,
        email: data.user.email ?? '',
        role: data.user.role ?? 'authenticated',
      };

      next();
    } catch {
      next(new AuthenticationError('Authentication failed', 'INVALID_TOKEN'));
    }
  };
}

export function createOptionalAuthMiddleware(supabase: SupabaseClient) {
  return async function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = extractBearerToken(req);
    if (!token) return next();

    try {
      const { data } = await supabase.auth.getUser(token);
      if (data.user) {
        req.user = {
          id: data.user.id,
          email: data.user.email ?? '',
          role: data.user.role ?? 'authenticated',
        };
      }
    } catch {
      // Silently ignore — optional auth never blocks
    }

    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required', 'AUTHENTICATION_REQUIRED'));
  }
  next();
}
