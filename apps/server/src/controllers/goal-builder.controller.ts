import type { Request, Response, NextFunction } from 'express';
import type { GoalBuilderService, SessionTaskModification } from '../services/goal-builder.service';

export class GoalBuilderController {
  constructor(private readonly service: GoalBuilderService) {}

  start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

      const { templateId, templateName } = req.body as { templateId?: string; templateName?: string };
      if (!templateId || !templateName) {
        res.status(400).json({ error: 'templateId and templateName are required' });
        return;
      }

      const result = await this.service.startSession(userId, templateId, templateName);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  answer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, answer } = req.body as { sessionId?: string; answer?: unknown };
      if (!sessionId || answer === undefined) {
        res.status(400).json({ error: 'sessionId and answer are required' });
        return;
      }
      const result = await this.service.answerQuestion(sessionId, String(answer));
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

      const { sessionId, modifications } = req.body as {
        sessionId?: string;
        modifications?: SessionTaskModification;
      };
      if (!sessionId) { res.status(400).json({ error: 'sessionId is required' }); return; }

      const result = await this.service.approveSession(sessionId, modifications);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getSession = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const session = this.service.getSession(req.params['id'] ?? '');
      if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
      res.json({ session });
    } catch (err) {
      next(err);
    }
  };
}
