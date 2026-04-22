import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { healthCheck } from './controllers/health.controller';
import { listTemplates, getTemplate } from './controllers/goalTemplate.controller';
import { generatePlan } from './controllers/planning.controller';
import { calculateScore } from './controllers/scoring.controller';
import { generateBrief } from './controllers/dailyLoop.controller';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

app.get('/health', healthCheck);

app.get('/templates', listTemplates);
app.get('/templates/:id', getTemplate);

app.post('/plans/generate', generatePlan);

app.post('/scores/calculate', calculateScore);

app.post('/brief/generate', generateBrief);

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

export default app;
