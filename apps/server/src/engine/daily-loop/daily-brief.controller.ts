import type { Request, Response, NextFunction } from 'express';
import { dailyBriefService } from './daily-brief.service';

export function getBriefForToday(req: Request, res: Response, next: NextFunction): void {
  try {
    const brief = dailyBriefService.getBriefForToday(req.user!.id);
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
