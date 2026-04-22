import type { Request, Response, NextFunction } from 'express';
import { planningService } from '../services/planning.service';
import type { AuthRequest } from '../middleware/auth.middleware';

export async function generatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { goalId } = req.params;
    const { templateId, answers } = req.body as { templateId: string; answers: import('../engine/planning/types').DiagnosticAnswers };
    const userId = (req as AuthRequest).userId ?? req.body.userId;

    const plan = await planningService.generatePlan(goalId!, templateId, answers, {
      userId,
      timezone: req.body.timezone ?? 'UTC',
    });

    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { goalId } = req.params;
    const plan = await planningService.getPlanForGoal(goalId!);
    if (!plan) {
      res.status(404).json({ error: 'No plan found for this goal' });
      return;
    }
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}
