import { DailyBrief, Task } from '@lyfestack/shared';
import { TaskScorer, ScoredTask } from '../scoring';
import { logger } from '../../utils/logger';

export interface DailyBriefOutput {
  userId: string;
  date: string;
  greeting: string;
  actions: ScoredTask[];
  automations: ScoredTask[];
  momentum: { streak: number; completionRate: number };
}

export class DailyLoopEngine {
  private scorer = new TaskScorer();

  generateBrief(userId: string, tasks: Task[], adaptiveTaskCap: number = 3, streak: number = 0): DailyBriefOutput {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const { actions, automations } = this.scorer.getTopTasks(tasks, adaptiveTaskCap, now);

    logger.info({ userId, actionCount: actions.length, automationCount: automations.length }, 'Daily brief generated');

    return {
      userId,
      date: (now.toISOString().split('T')[0]) as string,
      greeting,
      actions,
      automations,
      momentum: { streak, completionRate: 0 },
    };
  }

  calculateAdaptiveTaskCap(baselineCap: number, engagementVelocity: number): number {
    if (engagementVelocity >= 0.9) return Math.min(baselineCap + 2, 7);
    if (engagementVelocity >= 0.7) return baselineCap + 1;
    if (engagementVelocity <= 0.3) return Math.max(baselineCap - 1, 1);
    return baselineCap;
  }
}
