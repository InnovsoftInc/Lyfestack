import { Router } from 'express';
import type { Request, Response } from 'express';
import { automationsService } from './automations.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const list = await automationsService.list();
  res.json({ data: list });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, agentName, cronExpression, scheduleLabel, message, enabled } = req.body as Record<string, string>;
  if (!name || !agentName || !cronExpression || !message) {
    return res.status(400).json({ error: 'name, agentName, cronExpression and message are required' });
  }
  const automation = await automationsService.create({ name, agentName, cronExpression, scheduleLabel: scheduleLabel ?? cronExpression, message, enabled: enabled !== false });
  res.status(201).json({ data: automation });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await automationsService.delete(req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  const updated = await automationsService.toggle(req.params.id, Boolean(enabled));
  if (!updated) return res.status(404).json({ error: 'Automation not found' });
  res.json({ data: updated });
});

router.post('/:id/run', async (req: Request, res: Response) => {
  const result = await automationsService.runNow(req.params.id);
  res.json({ data: result });
});

export { router as automationsRouter };
