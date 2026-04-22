import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { openClawService } from './openclaw.service';
import { ValidationError } from '../../errors/AppError';

const createAgentSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be lowercase alphanumeric with hyphens'),
  name: z.string().optional(),
  role: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
});

export class OpenClawController {
  getStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await openClawService.getGatewayStatus();
      res.json({ data: status });
    } catch (err) {
      next(err);
    }
  };

  listAgents = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agents = await openClawService.listAgents();
      res.json({ data: agents });
    } catch (err) {
      next(err);
    }
  };

  createAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }
    try {
      const { id, name, role, systemPrompt } = parsed.data;
      await openClawService.createAgent({
        id,
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(systemPrompt !== undefined && { systemPrompt }),
      });
      const agent = await openClawService.getAgent(id);
      res.status(201).json({ data: agent });
    } catch (err) {
      next(err);
    }
  };

  getAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await openClawService.getAgent(req.params.name!);
      res.json({ data: agent });
    } catch (err) {
      next(err);
    }
  };

  deleteAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await openClawService.deleteAgent(req.params.name!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }
    try {
      const agentId = req.params.name!;

      // Stream via SSE if client supports it
      const acceptsStream = req.headers.accept?.includes('text/event-stream');
      if (acceptsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let fullResponse = '';
        await openClawService.sendMessage(agentId, parsed.data.message, (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ done: true, response: fullResponse })}\n\n`);
        res.end();
      } else {
        const response = await openClawService.sendMessage(agentId, parsed.data.message);
        res.json({ data: { response } });
      }
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = req.params.name!;
      const limit = Number(req.query.limit) || 50;
      const messages = await openClawService.getAgentHistory(agentId, limit);
      res.json({ data: messages });
    } catch (err) {
      next(err);
    }
  };

  getAgentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = req.params.name!;
      const status = await openClawService.getAgentStatus(agentId);
      res.json({ data: status });
    } catch (err) {
      next(err);
    }
  };
}

export const openClawController = new OpenClawController();
