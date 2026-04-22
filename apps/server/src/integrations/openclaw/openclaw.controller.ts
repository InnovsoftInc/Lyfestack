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
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    await service.deleteAgent(name);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    const response = await service.sendMessage(name, req.body.message as string);
    res.json({ data: { response } });
  } catch (err) { next(err); }
};
