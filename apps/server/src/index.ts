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
import { createUsersRouter } from './routes/users.routes';
import { createIntegrationsRouter } from './routes/integrations.routes';
import { openclawRoutes } from './integrations/openclaw/openclaw.routes';
import { getStatus as openclawStatus } from './integrations/openclaw/openclaw.controller';
import { createGoalRouter } from './routes/goal.routes';
import { startCronJobs } from './jobs/cron';
import { createAuthMiddleware, requireAuth } from './middleware/auth.middleware';
import { getSupabaseClient } from './config/database';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

const authMiddleware = createAuthMiddleware(getSupabaseClient());

// Core
app.get('/health', healthCheck);
app.use('/auth', createAuthRouter());

// T4.1 — Templates (public)
app.get('/templates', getTemplates);
app.get('/templates/:id', getTemplateById);

// T4.2 — Planning
app.post('/goals/:goalId/plan', authMiddleware, requireAuth, createPlan);
app.get('/goals/:goalId/plan', authMiddleware, requireAuth, getPlan);

// T5.2 — Daily Briefs
app.get('/briefs/today', authMiddleware, requireAuth, getBriefForToday);
app.get('/briefs/:date', authMiddleware, requireAuth, getBriefForDate);
app.patch('/briefs/:id/tasks/:taskId', authMiddleware, requireAuth, markTaskComplete);

// T6.1 — Agents
app.post('/agents/execute', authMiddleware, requireAuth, executeAgent);
app.get('/agents/actions', authMiddleware, requireAuth, getAvailableAgents);

// Phase 5 — Users / Push tokens
app.use('/users', createUsersRouter());

// Phase 5 — Integrations (Calendar, Buffer)
app.use('/integrations', createIntegrationsRouter());

// Goals CRUD
app.use('/api/goals', createGoalRouter());

// OpenClaw bridge — status is public (used for connection discovery), rest requires auth
app.get('/api/openclaw/status', openclawStatus);
app.use('/api/openclaw', authMiddleware, requireAuth, openclawRoutes);

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  startCronJobs();
});

export default app;
