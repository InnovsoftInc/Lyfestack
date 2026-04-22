import { logger } from '../utils/logger';
import { generateDailyBrief } from '../services/brief.service';

export class DailyBriefJob {
  readonly name = 'daily-brief';
  readonly schedule = '0 6 * * *';

  async run(userId: string, userName?: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0] ?? new Date().toDateString();
    logger.info({ userId, job: this.name, date: today }, 'Running daily brief job');

    const brief = await generateDailyBrief({
      userId,
      date: today,
      tasks: [],
      userName,
    });

    logger.info({ userId, briefId: brief.id }, 'Daily brief generated');
    // Production: persist to DB and push notification to user
  }
}

export const dailyBriefJob = new DailyBriefJob();
