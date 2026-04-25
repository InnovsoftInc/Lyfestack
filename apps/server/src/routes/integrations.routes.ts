import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createAuthMiddleware, requireAuth } from '../middleware/auth.middleware';
import { getSupabaseClient } from '../config/database';
import { calendarService } from '../integrations/calendar/calendar.service';
import { bufferService } from '../integrations/buffer/buffer.service';
import { lyfestackRouter } from '../integrations/lyfestack/lyfestack.routes';
import { config } from '../config/config';

const schedulePostSchema = z.object({
  content: z.string().min(1).max(500),
  scheduledAt: z.string().datetime(),
  profileId: z.string().optional(),
});

export function createIntegrationsRouter(): Router {
  const supabase = getSupabaseClient();
  const authMiddleware = createAuthMiddleware(supabase);
  const router = Router();

  // ── LyfeStack channel receiver ─────────────────────────────────────────
  router.use('/lyfestack', lyfestackRouter);

  // ── Google Calendar ──────────────────────────────────────────────────────

  router.get('/calendar/auth', authMiddleware, requireAuth, (req: Request, res: Response) => {
    const url = calendarService.getAuthUrl(req.user!.id);
    res.json({ url });
  });

  router.get('/calendar/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.query['code'] as string;
      const userId = req.query['state'] as string;

      if (!code || !userId) {
        res.status(400).json({ error: 'Missing code or state' });
        return;
      }

      await calendarService.handleCallback(code, userId);

      // Redirect back to mobile deep link or frontend
      const redirect = `${config.APP_BASE_URL}/integrations?connected=calendar`;
      res.redirect(redirect);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/calendar/sync',
    authMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tasks = req.body.tasks ?? [];
        await calendarService.syncTasksToCalendar(req.user!.id, tasks);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/calendar',
    authMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await calendarService.disconnect(req.user!.id);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Buffer ───────────────────────────────────────────────────────────────

  router.get('/buffer/auth', authMiddleware, requireAuth, (req: Request, res: Response) => {
    const url = bufferService.getAuthUrl(req.user!.id);
    res.json({ url });
  });

  router.get('/buffer/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.query['code'] as string;
      const userId = req.query['state'] as string;

      if (!code || !userId) {
        res.status(400).json({ error: 'Missing code or state' });
        return;
      }

      await bufferService.handleCallback(code, userId);

      const redirect = `${config.APP_BASE_URL}/integrations?connected=buffer`;
      res.redirect(redirect);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/buffer/schedule',
    authMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = schedulePostSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
          return;
        }

        const { content, scheduledAt, profileId } = parsed.data;
        const result = await bufferService.schedulePost(
          req.user!.id,
          content,
          new Date(scheduledAt),
          profileId,
        );

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/buffer',
    authMiddleware,
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await bufferService.disconnect(req.user!.id);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Status ───────────────────────────────────────────────────────────────

  router.get(
    '/status',
    authMiddleware,
    requireAuth,
    (req: Request, res: Response) => {
      const userId = req.user!.id;
      res.json({
        calendar: { connected: calendarService.isConnected(userId) },
        buffer: { connected: bufferService.isConnected(userId) },
      });
    },
  );

  return router;
}
