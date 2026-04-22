import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { healthCheck } from './controllers/health.controller';
import { createAuthRouter } from './routes/auth.routes';
import { getTemplates, getTemplateById } from './templates/template.controller';
import { createPlan, getPlan } from './engine/planning/planning.controller';
import {
  getBriefForToday,
  getBriefForDate,
  markTaskComplete,
} from './engine/daily-loop/daily-brief.controller';
import { executeAgent, getAvailableAgents } from './agents/agent.controller';
import { startCronJobs } from './jobs/cron';
import { createGoalRouter } from './routes/goal.routes';
import { briefController } from './controllers/brief.controller';
import { createAuthMiddleware, requireAuth } from './middleware/auth.middleware';
import { getSupabaseClient } from './config/database';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

// Core
app.get('/health', healthCheck);
app.use('/auth', createAuthRouter());

// T4.1 — Templates
app.get('/templates', getTemplates);
app.get('/templates/:id', getTemplateById);

// T4.2 — Planning
app.post('/goals/:goalId/plan', createPlan);
app.get('/goals/:goalId/plan', getPlan);

// T5.2 — Daily Briefs
app.get('/briefs/today', getBriefForToday);
app.get('/briefs/:date', getBriefForDate);
app.patch('/briefs/:id/tasks/:taskId', markTaskComplete);

// T6.1 — Agents
app.post('/agents/execute', executeAgent);
app.get('/agents/actions', getAvailableAgents);

// Phase 4 — Goal CRUD + Plan generation (authenticated)
app.use('/api/goals', createGoalRouter());

// Phase 4 — Brief API (authenticated)
let _briefAuthMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;
function getBriefAuthMiddleware() {
  if (!_briefAuthMiddleware) {
    try {
      _briefAuthMiddleware = createAuthMiddleware(getSupabaseClient());
    } catch {
      _briefAuthMiddleware = (_req, _res, next) => next();
    }
  }
  return _briefAuthMiddleware;
}
app.get('/api/briefs/today', (req, res, next) => getBriefAuthMiddleware()(req, res, next), requireAuth, briefController.getTodayBrief);
app.patch('/api/briefs/tasks/:id', (req, res, next) => getBriefAuthMiddleware()(req, res, next), requireAuth, briefController.updateTaskStatus);

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  startCronJobs();
});

export default app;
