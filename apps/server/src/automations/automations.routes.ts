import { Router } from 'express';
import type { Request, Response } from 'express';
import { automationsService } from './automations.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const list = await automationsService.list();
  res.json({ data: list });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, triggerPath, messageTemplate, agentName, model, channel, deliver } = req.body as Record<string, unknown>;
  if (!name || !triggerPath || !messageTemplate) {
    return res.status(400).json({ error: 'name, triggerPath and messageTemplate are required' });
  }
  try {
    const routine = await automationsService.create({
      name: String(name),
      triggerPath: String(triggerPath),
      messageTemplate: String(messageTemplate),
      agentName: agentName ? String(agentName) : undefined,
      model: model ? String(model) : undefined,
      channel: channel ? String(channel) : undefined,
      deliver: deliver === true || deliver === 'true',
    });
    res.status(201).json({ data: routine });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create routine' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await automationsService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete routine' });
  }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  const updated = await automationsService.toggle(req.params.id, Boolean(enabled));
  if (!updated) return res.status(400).json({ error: 'Only hook routines can be toggled from the app' });
  res.json({ data: updated });
});

router.post('/:id/run', async (_req: Request, res: Response) => {
  const result = await automationsService.runNow(_req.params.id);
  res.json({ data: result });
});

export { router as automationsRouter };
