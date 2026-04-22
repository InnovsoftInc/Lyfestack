import cron from 'node-cron';
import { logger } from '../utils/logger';
import { runDailyBriefJob } from './daily-brief.job';
import { runStreakCheckJob } from './streak-check.job';

export function startCronJobs(): void {
  // Every 15 minutes — check for users due for daily briefs and generate them
  cron.schedule('*/15 * * * *', () => {
    void runDailyBriefJob();
  });

  // Once a day at 8 PM — evaluate streaks and send at-risk alerts
  cron.schedule('0 20 * * *', () => {
    void runStreakCheckJob();
  });

  logger.info('Cron jobs started (brief: */15 min, streak: daily 20:00)');
}
