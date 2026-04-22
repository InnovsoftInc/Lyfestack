import type { Request, Response, NextFunction } from 'express';
import { TaskStatus } from '@lyfestack/shared';
import { dailyBriefService } from './daily-brief.service';
import { TaskRepository } from '../../repositories/task.repository';

let _taskRepository: TaskRepository | null = null;

function getTaskRepository(): TaskRepository | null {
  if (_taskRepository) return _taskRepository;
  try {
    const { getSupabaseClient } = require('../../config/database') as { getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient };
    _taskRepository = new TaskRepository(getSupabaseClient());
    return _taskRepository;
  } catch {
    return null;
  }
}

export async function getBriefForToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const repo = getTaskRepository();
    const tasks = repo
      ? await repo.findByUserId(userId).then((all) =>
          all.filter((t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.APPROVED),
        )
      : [];
    dailyBriefService.generateBrief({ userId, engagementVelocity: 0.7, timezone: 'UTC' }, tasks);
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

export async function markTaskComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, taskId } = req.params;
    if (!id || !taskId) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'id and taskId required' } });
      return;
    }
    const repo = getTaskRepository();
    if (repo) {
      await repo.updateStatus(taskId, TaskStatus.COMPLETED);
    }
    const brief = dailyBriefService.markTaskComplete(id, taskId, req.user!.id);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}
