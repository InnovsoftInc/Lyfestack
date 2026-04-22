import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { healthCheck } from './controllers/health.controller';
import { getAllTemplates, getTemplateById } from './controllers/goal-template.controller';
import { generatePlan, getPlan } from './controllers/plan.controller';
import { getTodaysBrief, getBriefByDate, markTaskComplete } from './controllers/daily-brief.controller';
import { executeAgentAction, getAgentActions } from './controllers/agent.controller';
import { startCronJobs } from './jobs/cron';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

app.get('/health', healthCheck);

// Templates
app.get('/templates', getAllTemplates);
app.get('/templates/:id', getTemplateById);

// Plans
app.post('/goals/:goalId/plan', generatePlan);
app.get('/goals/:goalId/plan', getPlan);

// Daily Briefs
app.get('/briefs/today', getTodaysBrief);
app.get('/briefs/:date', getBriefByDate);
app.patch('/briefs/:id/tasks/:taskId', markTaskComplete);

// Agents
app.post('/agents/execute', executeAgentAction);
app.get('/agents/actions', getAgentActions);

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  startCronJobs();
});

export default app;
