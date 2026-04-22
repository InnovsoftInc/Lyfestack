import type { Request, Response, NextFunction } from 'express';
import { planningService } from './planning.service';
import { TrustTier } from '@lyfestack/shared';

export function createPlan(req: Request, res: Response, next: NextFunction): void {
  try {
    const goalId = req.params['goalId'];
    if (!goalId) {
      res.status(400).json({ error: { code: 'MISSING_GOAL_ID', message: 'Goal ID required' } });
      return;
    }

    const { templateId, answers, userId, engagementVelocity, currentTaskLoad } = req.body as {
      templateId: string;
      answers: { questionId: string; value: string | number | boolean }[];
      userId: string;
      engagementVelocity?: number;
      currentTaskLoad?: number;
    };

    const plan = planningService.createPlan(goalId, templateId, answers, {
      userId,
      trustTier: TrustTier.AUTONOMOUS,
      engagementVelocity: engagementVelocity ?? 0.5,
      currentTaskLoad: currentTaskLoad ?? 0,
    });

    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

export function getPlan(req: Request, res: Response, next: NextFunction): void {
  try {
    const goalId = req.params['goalId'];
    if (!goalId) {
      res.status(400).json({ error: { code: 'MISSING_GOAL_ID', message: 'Goal ID required' } });
      return;
    }
    const plan = planningService.getPlanForGoal(goalId);
    res.json({ plan });
  } catch (err) {
    next(err);
  }
}
