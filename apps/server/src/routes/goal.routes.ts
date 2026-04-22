import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller';
import { GoalService } from '../services/goal.service';
import { GoalRepository } from '../repositories/goal.repository';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';

let _goalRepository: GoalRepository | null = null;

function getGoalRepository(): GoalRepository | null {
  if (_goalRepository) return _goalRepository;
  try {
    const { getSupabaseClient } = require('../config/database') as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient };
    const supabase = getSupabaseClient();
    _goalRepository = new GoalRepository(supabase);
    return _goalRepository;
  } catch {
    return null;
  }
}

export function createGoalRouter(): Router {
  const goalService = new GoalService(getGoalRepository());
  const goalController = new GoalController(goalService);

  let authMiddleware: ReturnType<typeof createAuthMiddleware>;
  try {
    const { getSupabaseClient } = require('../config/database') as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient };
    authMiddleware = createAuthMiddleware(getSupabaseClient());
  } catch {
    // If DB not configured, use a passthrough middleware
    authMiddleware = (_req, _res, next) => next();
  }

  const router = Router();

  router.post('/', authMiddleware, requireAuth, goalController.createGoal);
  router.get('/', authMiddleware, requireAuth, goalController.getGoals);
  router.get('/:id', authMiddleware, requireAuth, goalController.getGoal);
  router.post('/:id/plan', authMiddleware, requireAuth, goalController.generatePlan);

  return router;
}
