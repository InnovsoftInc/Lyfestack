import type { Request, Response, NextFunction } from 'express';
import { agentOrchestrator } from './agent.orchestrator';

export async function executeAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { agentKey, userId, prompt, context, requestedActions } = req.body as {
      agentKey: string;
      userId: string;
      prompt: string;
      context?: Record<string, unknown>;
      requestedActions?: string[];
    };

    if (!agentKey || !userId || !prompt) {
      res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'agentKey, userId, and prompt are required' },
      });
      return;
    }

    const output = await agentOrchestrator.dispatch({
      agentKey,
      input: { userId, prompt, ...(context !== undefined && { context }) },
      ...(requestedActions !== undefined && { requestedActions }),
    });

    res.json({ output });
  } catch (err) {
    next(err);
  }
}

export function getAvailableAgents(_req: Request, res: Response): void {
  const agents = agentOrchestrator.getAvailableAgents();
  res.json({ agents });
}
