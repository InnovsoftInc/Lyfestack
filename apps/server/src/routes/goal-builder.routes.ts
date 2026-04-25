import { Router } from 'express';
import { GoalBuilderController } from '../controllers/goal-builder.controller';
import { GoalBuilderService } from '../services/goal-builder.service';
import { GoalService } from '../services/goal.service';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';
import { GoalRepository } from '../repositories/goal.repository';
import { PlanRepository } from '../repositories/plan.repository';
import { TaskRepository } from '../repositories/task.repository';
import { automationsService } from '../automations/automations.service';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';

export function createGoalBuilderRouter(): Router {
  let goalRepository: GoalRepository | null = null;
  let planRepository: PlanRepository | null = null;
  let taskRepository: TaskRepository | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../config/database') as {
      getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient;
    };
    const supabase = getSupabaseClient();
    goalRepository = new GoalRepository(supabase);
    planRepository = new PlanRepository(supabase);
    taskRepository = new TaskRepository(supabase);
  } catch { /* DB not configured */ }

  const openClaw = new OpenClawService();
  const goalService = new GoalService(goalRepository, taskRepository);
  const service = new GoalBuilderService(openClaw, goalService, planRepository, automationsService);
  const controller = new GoalBuilderController(service);

  let authMiddleware: ReturnType<typeof createAuthMiddleware>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../config/database') as {
      getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient;
    };
    authMiddleware = createAuthMiddleware(getSupabaseClient());
  } catch {
    authMiddleware = (_req, _res, next): Promise<void> => Promise.resolve(next());
  }

  const router = Router();
  router.post('/start', authMiddleware, requireAuth, controller.start);
  router.post('/answer', controller.answer);
  router.post('/approve', authMiddleware, requireAuth, controller.approve);
  router.get('/session/:id', authMiddleware, requireAuth, controller.getSession);

  return router;
}
