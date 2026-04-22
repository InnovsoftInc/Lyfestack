import { startDailyBriefJob } from './daily-brief.job';
import { startStreakCheckJob } from './streak-check.job';

export function startAllJobs(): void {
  startDailyBriefJob();
  startStreakCheckJob();
}
