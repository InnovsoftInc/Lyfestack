import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller';
import { GoalService } from '../services/goal.service';
import { GoalRepository } from '../repositories/goal.repository';
import { TaskRepository } from '../repositories/task.repository';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';

let _goalRepository: GoalRepository | null = null;
let _taskRepository: TaskRepository | null = null;

function getRepositories(): { goals: GoalRepository | null; tasks: TaskRepository | null } {
  try {
    const { getSupabaseClient } = require('../config/database') as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient };
    const supabase = getSupabaseClient();
    if (!_goalRepository) _goalRepository = new GoalRepository(supabase);
    if (!_taskRepository) _taskRepository = new TaskRepository(supabase);
    return { goals: _goalRepository, tasks: _taskRepository };
  } catch {
    return { goals: null, tasks: null };
  }
}

export function createGoalRouter(): Router {
  const { goals, tasks } = getRepositories();
  const goalService = new GoalService(goals, tasks);
  const goalController = new GoalController(goalService);

  let authMiddleware: ReturnType<typeof createAuthMiddleware>;
  try {
    const { getSupabaseClient } = require('../config/database') as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient };
    authMiddleware = createAuthMiddleware(getSupabaseClient());
  } catch {
    // If DB not configured, use a passthrough middleware
    authMiddleware = (_req, _res, next): Promise<void> => Promise.resolve(next());
  }

  const router = Router();

  router.post('/', authMiddleware, requireAuth, goalController.createGoal);
  router.get('/', authMiddleware, requireAuth, goalController.getGoals);
  router.get('/:id', authMiddleware, requireAuth, goalController.getGoal);
  router.post('/:id/plan', authMiddleware, requireAuth, goalController.generatePlan);

  return router;
}
