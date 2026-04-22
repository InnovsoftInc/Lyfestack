import type { Request, Response, NextFunction } from 'express';
import { dailyBriefService } from './daily-brief.service';

export function getBriefForToday(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.query['userId'] as string | undefined;
    if (!userId) {
      res.status(400).json({ error: { code: 'MISSING_USER_ID', message: 'userId query param required' } });
      return;
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
    const userId = req.query['userId'] as string | undefined;
    if (!userId || !date) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'userId and date required' } });
      return;
    }
    const brief = dailyBriefService.getBriefForDate(userId, date);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}

export function markTaskComplete(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id, taskId } = req.params;
    const userId = req.body?.userId as string | undefined;
    if (!id || !taskId || !userId) {
      res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'id, taskId, and userId required' } });
      return;
    }
    const brief = dailyBriefService.markTaskComplete(id, taskId, userId);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}
