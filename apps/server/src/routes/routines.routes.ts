import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { routinesService } from '../services/routines.service';

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

export function createRoutinesRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ routines: routinesService.listRoutines() });
  });

  router.post('/', wrap(async (req, res) => {
    const routine = routinesService.createRoutine(req.body as Parameters<typeof routinesService.createRoutine>[0]);
    res.status(201).json({ routine });
  }));

  router.patch('/:id', wrap(async (req, res) => {
    const routine = routinesService.updateRoutine(req.params.id, req.body as Parameters<typeof routinesService.updateRoutine>[1]);
    res.json({ routine });
  }));

  router.delete('/:id', (req, res, next) => {
    try {
      routinesService.deleteRoutine(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/toggle', (req, res, next) => {
    try {
      const routine = routinesService.toggleRoutine(req.params.id);
      res.json({ routine });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/run', wrap(async (req, res) => {
    const record = await routinesService.runNow(req.params.id);
    res.json({ record });
  }));

  router.get('/:id/history', (req, res, next) => {
    try {
      const history = routinesService.getRunHistory(req.params.id);
      res.json({ history });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
