import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { healthCheck } from './controllers/health.controller';
import templateRoutes from './routes/template.routes';
import planRoutes from './routes/plan.routes';
import scoreRoutes from './routes/score.routes';
import briefRoutes from './routes/brief.routes';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

app.get('/health', healthCheck);
app.use('/api/templates', templateRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/briefs', briefRoutes);

app.use(errorMiddleware);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

export default app;
