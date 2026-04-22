import type { Request, Response, NextFunction } from 'express';
import { planningService } from '../services/planning.service';

export function generatePlan(req: Request, res: Response, next: NextFunction): void {
  try {
    const plan = planningService.generatePlan(req.body);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}
