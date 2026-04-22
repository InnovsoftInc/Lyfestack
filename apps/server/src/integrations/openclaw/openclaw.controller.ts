import { Request, Response, NextFunction } from 'express';
import { OpenClawService } from './openclaw.service';

const service = new OpenClawService();

export const getStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getStatus() }); } catch (err) { next(err); }
};

export const listAgents = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.listAgents() }); } catch (err) { next(err); }
};

export const createAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.createAgent(req.body);
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
};

export const deleteAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteAgent(req.params.name ?? '');
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await service.sendMessage(req.params.name ?? '', req.body.message);
    res.json({ data: { response } });
  } catch (err) { next(err); }
};

export const listSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 20;
    res.json({ data: await service.listSessions(limit) });
  } catch (err) { next(err); }
};

export const getSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = String(req.query.key ?? '');
    if (!key) return res.status(400).json({ error: 'key query param required' });
    res.json({ data: await service.getSession(key) });
  } catch (err) { next(err); }
};

export const createSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, label } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });
    res.status(201).json({ data: await service.createSession(agentId, label) });
  } catch (err) { next(err); }
};
