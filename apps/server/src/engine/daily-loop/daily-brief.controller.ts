import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TaskType, TaskStatus, ApprovalState } from '@lyfestack/shared';
import type { Task } from '@lyfestack/shared';
import { dailyBriefService } from './daily-brief.service';

function buildMockTasks(userId: string): Task[] {
  const now = new Date().toISOString();
  return [
    {
      id: uuidv4(),
      goalId: 'mock-goal-1',
      userId,
      title: 'Morning workout — 30 min cardio',
      description: 'Complete your scheduled cardio session',
      type: TaskType.HABIT,
      status: TaskStatus.PENDING,
      approvalState: ApprovalState.PENDING,
      priority: 90,
      estimatedMinutes: 30,
      confidenceScore: 0.9,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      goalId: 'mock-goal-1',
      userId,
      title: 'Review weekly progress',
      description: 'Check in on your goal metrics and adjust tasks',
      type: TaskType.REFLECTION,
      status: TaskStatus.PENDING,
      approvalState: ApprovalState.PENDING,
      priority: 75,
      estimatedMinutes: 15,
      confidenceScore: 0.8,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      goalId: 'mock-goal-2',
      userId,
      title: 'Write 500 words',
      description: 'Continue your writing habit',
      type: TaskType.ACTION,
      status: TaskStatus.PENDING,
      approvalState: ApprovalState.PENDING,
      priority: 70,
      estimatedMinutes: 25,
      confidenceScore: 0.85,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getBriefForToday(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.user!.id;
    if (!dailyBriefService.hasBriefForToday(userId)) {
      dailyBriefService.generateBrief(
        { userId, engagementVelocity: 0.7, timezone: 'UTC' },
        buildMockTasks(userId),
      );
    }
    const brief = dailyBriefService.getBriefForToday(userId);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}

export function getBriefForDate(req: Request, res: Response, next: NextFunction): void {
  try {
    const { date } = req.params;
    if (!date) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'date required' } });
      return;
    }
    const brief = dailyBriefService.getBriefForDate(req.user!.id, date);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}

export function markTaskComplete(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id, taskId } = req.params;
    if (!id || !taskId) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'id and taskId required' } });
      return;
    }
    const brief = dailyBriefService.markTaskComplete(id, taskId, req.user!.id);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}
