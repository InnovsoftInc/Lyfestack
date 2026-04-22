import type { Request, Response, NextFunction } from 'express';
import { scoringService } from '../services/scoring.service';

export function calculateScore(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = scoringService.calculateScore(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}
