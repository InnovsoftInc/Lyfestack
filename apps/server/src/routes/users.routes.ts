import { Router } from 'express';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';
import { getSupabaseClient } from '../config/database';
import { savePushToken } from '../controllers/users.controller';

export function createUsersRouter(): Router {
  const supabase = getSupabaseClient();
  const authMiddleware = createAuthMiddleware(supabase);
  const router = Router();

  router.post('/push-token', authMiddleware, requireAuth, savePushToken);

  return router;
}
