import type { Request, Response, NextFunction } from 'express';
import { agentService } from '../services/agent.service';
import type { AuthRequest } from '../middleware/auth.middleware';

export async function executeAgentAction(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as AuthRequest).userId ?? req.body.userId;
    const { taskType, payload } = req.body as { taskType: string; payload: Record<string, unknown> };

    const response = await agentService.execute({ userId, taskType, payload: payload ?? {} });
    res.json({ data: response });
  } catch (err) {
    next(err);
  }
}

export function getAgentActions(req: Request, res: Response, next: NextFunction) {
  try {
    const actions = agentService.getAllowedActions();
    res.json({ data: actions });
  } catch (err) {
    next(err);
  }
}
