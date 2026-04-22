import cron from 'node-cron';
import { dailyLoopEngine } from '../engine/daily-loop/DailyLoopEngine';
import { logger } from '../utils/logger';

export function startCronJobs() {
  // Every 15 minutes — check which users need their morning brief
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('Cron: running morning cycle check');
    try {
      await dailyLoopEngine.runMorningCycle();
    } catch (err) {
      logger.error({ err }, 'Cron: morning cycle failed');
    }
  });

  logger.info('Cron jobs started');
}
