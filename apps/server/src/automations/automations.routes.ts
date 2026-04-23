import { Router } from 'express';
import type { Request, Response } from 'express';
import { automationsService } from './automations.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const list = await automationsService.list();
  res.json({ data: list });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, schedule, agent, prompt, enabled, notify } = req.body as Record<string, unknown>;
  if (!name || !schedule || !agent || !prompt) {
    return res.status(400).json({ error: 'name, schedule, agent, and prompt are required' });
  }
  try {
    const routine = await automationsService.create({
      name: String(name),
      schedule: String(schedule),
      agent: String(agent),
      prompt: String(prompt),
      enabled: enabled !== false && enabled !== 'false',
      ...(notify ? { notify: notify as { channel: string } } : {}),
    });
    res.status(201).json({ data: routine });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create routine' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await automationsService.delete(req.params.id as string);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete routine' });
  }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  try {
    const updated = await automationsService.toggle(req.params.id as string, Boolean(enabled));
    if (!updated) return res.status(400).json({ error: 'Routine not found or cannot be toggled' });
    res.json({ data: updated });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to toggle routine' });
  }
});

router.post('/:id/run', async (req: Request, res: Response) => {
  const result = await automationsService.runNow(req.params.id as string);
  res.json({ data: result });
});

router.get('/:id/history', async (req: Request, res: Response) => {
  const history = await automationsService.getRunHistory(req.params.id as string);
  res.json({ data: history });
});

export { router as automationsRouter };
