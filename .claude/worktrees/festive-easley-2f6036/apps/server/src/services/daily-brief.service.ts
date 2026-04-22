import type { DailyBrief } from '@lyfestack/shared';
import { TaskStatus } from '@lyfestack/shared';
import { briefRepository } from '../repositories/brief.repository';
import { taskRepository } from '../repositories/task.repository';
import { dailyLoopEngine } from '../engine/daily-loop/DailyLoopEngine';
import { NotFoundError } from '../errors/AppError';

export class DailyBriefService {
  async generateBrief(userId: string, timezone: string): Promise<DailyBrief> {
    const brief = await dailyLoopEngine.runForUser({ id: userId, timezone, preferred_brief_hour: 7, engagement_velocity: 0.5 });
    if (!brief) throw new Error('Brief already generated today or no active goals');
    return brief;
  }

  async getBriefForToday(userId: string): Promise<DailyBrief | null> {
    return briefRepository.findTodayForUser(userId);
  }

  async getBriefForDate(userId: string, date: string): Promise<DailyBrief> {
    const brief = await briefRepository.findByUserAndDate(userId, date);
    if (!brief) throw new NotFoundError(`No brief found for ${date}`);
    return brief;
  }

  async markTaskComplete(briefId: string, taskId: string, userId: string): Promise<DailyBrief> {
    const brief = await briefRepository.findById(briefId);
    if (brief.userId !== userId) throw new NotFoundError('Brief not found');

    await taskRepository.update(taskId, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    });

    const updatedBrief = await briefRepository.findById(briefId);
    return updatedBrief;
  }
}

export const dailyBriefService = new DailyBriefService();
