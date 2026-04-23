import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
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
import { automationsService } from './automations/automations.service';
import { createAuthMiddleware, requireAuth } from './middleware/auth.middleware';
import { getSupabaseClient } from './config/database';
import { planningEngine } from './engine/planning/planning.engine';
import { templateService } from './templates/template.service';
import { TrustTier } from '@lyfestack/shared';
import type { DiagnosticAnswer } from './templates/template.types';

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

// Plan preview SSE — no auth (pre-signup flow)
app.post('/api/plan-preview/stream', (req: Request, res: Response) => {
  const { templateId, answers = [] } = req.body as { templateId?: string; answers?: DiagnosticAnswer[] };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const steps = [
    { step: 'Analyzing your answers...', progress: 20 },
    { step: 'Building milestone timeline...', progress: 50 },
    { step: 'Generating personalized tasks...', progress: 80 },
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      write('progress', steps[i]!);
      i++;
    } else {
      clearInterval(interval);
      try {
        if (!templateId) {
          write('error', { message: 'templateId required' });
          res.end();
          return;
        }
        const template = templateService.getById(templateId);
        const plan = planningEngine.generatePlan(template, answers, {
          userId: 'preview',
          trustTier: TrustTier.AUTONOMOUS,
          engagementVelocity: 0.7,
          currentTaskLoad: 0,
        });
        write('complete', { plan });
      } catch (err) {
        write('error', { message: err instanceof Error ? err.message : 'Plan generation failed' });
      }
      res.end();
    }
  }, 450);

  req.on('close', () => { clearInterval(interval); });
});

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  startCronJobs();
  void automationsService.init();
});

export default app;
