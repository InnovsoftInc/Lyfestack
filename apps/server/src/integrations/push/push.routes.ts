import { Router } from 'express';
import { z } from 'zod';
import { listTokens, registerToken, unregisterToken } from './push-tokens.service';

const router = Router();

const registerSchema = z.object({
  token: z.string().min(8),
  device: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const userId = (req as { user?: { id?: string } }).user?.id;
    await registerToken({
      token: parsed.data.token,
      ...(userId ? { userId } : {}),
      ...(parsed.data.device ? { device: parsed.data.device } : {}),
    });
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/register/:token', async (req, res, next) => {
  try {
    if (!req.params.token) { res.status(400).json({ error: 'token required' }); return; }
    const ok = await unregisterToken(req.params.token);
    if (!ok) { res.status(404).json({ error: 'not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/tokens', async (req, res, next) => {
  try {
    const userId = (req as { user?: { id?: string } }).user?.id;
    res.json({ data: await listTokens(userId) });
  } catch (err) { next(err); }
});

export { router as pushRoutes };
