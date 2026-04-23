import type { Request, Response } from 'express';
import {
  startGuidedSession,
  submitAnswer,
  streamPlanGeneration,
} from '../services/guided-setup.service';
import { logger } from '../utils/logger';

export async function startSession(req: Request, res: Response): Promise<void> {
  const { templateId } = req.body as { templateId?: string };
  if (!templateId) {
    res.status(400).json({ error: { message: 'templateId is required' } });
    return;
  }
  try {
    const question = await startGuidedSession(templateId);
    res.json({ question });
  } catch (err) {
    logger.error({ err }, 'guided-setup: startSession failed');
    const message = err instanceof Error ? err.message : 'Failed to start session';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: { message } });
  }
}

export async function answerQuestion(req: Request, res: Response): Promise<void> {
  const { sessionId, answer } = req.body as { sessionId?: string; answer?: string };
  if (!sessionId || answer === undefined) {
    res.status(400).json({ error: { message: 'sessionId and answer are required' } });
    return;
  }
  try {
    const question = await submitAnswer(sessionId, String(answer));
    res.json({ question });
  } catch (err) {
    logger.error({ err, sessionId }, 'guided-setup: answerQuestion failed');
    const message = err instanceof Error ? err.message : 'Failed to process answer';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: { message } });
  }
}

export async function generatePlanSSE(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  await streamPlanGeneration(sessionId, res);
}
