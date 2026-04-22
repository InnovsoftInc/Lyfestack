import type { DailyBrief, Task } from '@lyfestack/shared';
import { NotFoundError, ValidationError } from '../../errors/AppError';
import { dailyLoopEngine } from './daily-loop.engine';
import type { BriefUser, StoredBrief } from './daily-loop.types';

// In-memory store: userId → (date → brief)
const briefStore = new Map<string, Map<string, StoredBrief>>();

function toPublicBrief(stored: StoredBrief): DailyBrief {
  return {
    id: stored.id,
    userId: stored.userId,
    date: stored.date,
    greeting: stored.greeting,
    summary: stored.summary,
    tasks: stored.tasks,
    insights: stored.insights,
    generatedAt: stored.generatedAt,
  };
}

export class DailyBriefService {
  generateBrief(user: BriefUser, availableTasks: Task[]): DailyBrief {
    const stored = dailyLoopEngine.generateBriefForUser(user, availableTasks);

    let userBriefs = briefStore.get(user.userId);
    if (!userBriefs) {
      userBriefs = new Map();
      briefStore.set(user.userId, userBriefs);
    }
    userBriefs.set(stored.date, stored);

    return toPublicBrief(stored);
  }

  getBriefForToday(userId: string): DailyBrief {
    const date = new Date().toISOString().slice(0, 10);
    return this.getBriefForDate(userId, date);
  }

  getBriefForDate(userId: string, date: string): DailyBrief {
    const stored = briefStore.get(userId)?.get(date);
    if (!stored) throw new NotFoundError(`Brief for ${userId} on ${date}`);
    return toPublicBrief(stored);
  }

  markTaskComplete(briefId: string, taskId: string, userId: string): DailyBrief {
    const userBriefs = briefStore.get(userId);
    if (!userBriefs) throw new NotFoundError(`Briefs for user ${userId}`);

    let target: StoredBrief | undefined;
    for (const brief of userBriefs.values()) {
      if (brief.id === briefId) {
        target = brief;
        break;
      }
    }

    if (!target) throw new NotFoundError(`Brief ${briefId}`);

    const taskExists = target.tasks.some((t) => t.id === taskId);
    if (!taskExists) throw new ValidationError(`Task ${taskId} not in brief ${briefId}`);

    target.completedTaskIds.add(taskId);
    return toPublicBrief(target);
  }
}

export const dailyBriefService = new DailyBriefService();
