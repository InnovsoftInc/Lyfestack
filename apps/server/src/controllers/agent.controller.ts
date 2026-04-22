import type { Request, Response, NextFunction } from 'express';
import { agentService } from '../services/agent.service';

export function dispatchAction(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = agentService.dispatch(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export function listAgents(_req: Request, res: Response, next: NextFunction): void {
  try {
    const agents = agentService.listAgents();
    res.status(200).json({ data: agents });
  } catch (err) {
    next(err);
  }
}
