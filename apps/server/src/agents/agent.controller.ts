import type { Request, Response, NextFunction } from 'express';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';

const openClawService = new OpenClawService();

export async function executeAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { agentKey, prompt } = req.body as {
      agentKey: string;
      prompt: string;
    };

    if (!agentKey || !prompt) {
      res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'agentKey and prompt are required' },
      });
      return;
    }

    const response = await openClawService.sendMessage(agentKey, prompt);
    res.json({ output: { result: response, agentKey } });
  } catch (err) {
    next(err);
  }
}

export async function getAvailableAgents(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agents = await openClawService.listAgents();
    res.json({ agents });
  } catch (err) {
    next(err);
  }
}
