import { logger } from '../utils/logger';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

async function runDailyLoopTick(): Promise<void> {
  logger.info('Daily loop tick — scoring and brief generation would run here');
  // When the user repository and task repository are wired in, this tick
  // will: fetch active users → score their pending tasks → upsert daily briefs.
}

export function startCronJobs(): void {
  void runDailyLoopTick();

  setInterval(() => {
    void runDailyLoopTick();
  }, FIFTEEN_MINUTES);

  logger.info('Cron jobs started (daily loop every 15 min)');
}
