import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { getSupabaseClient } from '../config/database';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';

export function createAuthRouter(): Router {
  const supabase = getSupabaseClient();
  const userRepository = new UserRepository(supabase);
  const authService = new AuthService(supabase, userRepository);
  const authController = new AuthController(authService);
  const authMiddleware = createAuthMiddleware(supabase);

  const router = Router();

  router.post('/signup',  authController.signup);
  router.post('/login',   authController.login);
  router.post('/logout',  authMiddleware, requireAuth, authController.logout);
  router.get('/me',       authMiddleware, requireAuth, authController.me);

  return router;
}
