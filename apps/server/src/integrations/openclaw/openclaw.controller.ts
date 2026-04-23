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

export const getAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const agent = await service.getAgent(name);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ data: agent });
  } catch (err) { next(err); }
};

export const updateAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    await service.updateAgent(name, req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const listAgentFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = await service.listAgentFiles(req.params.name);
    res.json({ data: files });
  } catch (err) { next(err); }
};

export const getAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await service.getAgentFile(req.params.name, req.params.filename);
    res.json({ data: { filename: req.params.filename, content } });
  } catch (err: any) {
    if (err.message?.includes('not accessible')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const updateAgentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateAgentFile(req.params.name, req.params.filename, req.body.content as string);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not writable')) { res.status(403).json({ error: err.message }); return; }
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    if (!name) { res.status(400).json({ error: 'Agent name required' }); return; }
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim()) { res.status(400).json({ error: 'message is required' }); return; }
    const response = await service.sendMessage(name, message);
    res.json({ data: { response } });
  } catch (err) { next(err); }
};

export const getConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getConfig() }); } catch (err) { next(err); }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.updateConfig(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const getAuthProfiles = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await service.getAuthProfiles() }); } catch (err) { next(err); }
};

export const updateAuthProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const { key } = req.body as { key: string };
    if (!name || !key) { res.status(400).json({ error: 'Profile name and key required' }); return; }
    await service.updateAuthProfile(name, key);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not found')) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
};
