import type { Request, Response, NextFunction } from 'express';
import { dailyLoopService } from '../services/dailyLoop.service';

export function generateDailyBrief(req: Request, res: Response, next: NextFunction): void {
  try {
    const brief = dailyLoopService.generateBrief(req.body);
    res.status(200).json({ data: brief });
  } catch (err) {
    next(err);
  }
}
