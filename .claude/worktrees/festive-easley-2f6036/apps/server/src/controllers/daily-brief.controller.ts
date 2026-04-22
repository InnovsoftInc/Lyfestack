import type { Request, Response, NextFunction } from 'express';
import { dailyBriefService } from '../services/daily-brief.service';
import type { AuthRequest } from '../middleware/auth.middleware';

function getUserId(req: Request): string {
  return (req as AuthRequest).userId ?? (req.query['userId'] as string) ?? '';
}

export async function getTodaysBrief(req: Request, res: Response, next: NextFunction) {
  try {
    const brief = await dailyBriefService.getBriefForToday(getUserId(req));
    if (!brief) {
      res.status(404).json({ error: 'No brief generated yet today' });
      return;
    }
    res.json({ data: brief });
  } catch (err) {
    next(err);
  }
}

export async function getBriefByDate(req: Request, res: Response, next: NextFunction) {
  try {
    const brief = await dailyBriefService.getBriefForDate(getUserId(req), req.params['date']!);
    res.json({ data: brief });
  } catch (err) {
    next(err);
  }
}

export async function markTaskComplete(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: briefId, taskId } = req.params;
    const brief = await dailyBriefService.markTaskComplete(briefId!, taskId!, getUserId(req));
    res.json({ data: brief });
  } catch (err) {
    next(err);
  }
}
