import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { listLyfeStackEvents, subscribeLyfeStackEvents, upsertLyfeStackEvent } from './lyfestack.events';

const router = Router();

const payloadSchema = z.object({
  deliveryKey: z.string().min(1),
  channel: z.string().min(1).default('lyfestack'),
  target: z.string().min(1),
  text: z.string().default(''),
  threadId: z.union([z.string(), z.number()]).nullable().optional(),
  replyToId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  payload: z.any().optional(),
  createdAt: z.string().datetime().optional(),
});

function verifySecret(req: Request): boolean {
  const expected = config.LYFESTACK_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const supplied = String(req.header('x-lyfestack-secret') ?? '').trim();
  return supplied === expected;
}

router.post('/events', (req, res) => {
  if (!verifySecret(req)) {
    res.status(401).json({ error: 'invalid secret' });
    return;
  }
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.format() });
    return;
  }
  const record = upsertLyfeStackEvent(parsed.data);
  logger.info({ deliveryKey: record.deliveryKey, target: record.target }, 'LyfeStack event received');
  res.json({ data: { messageId: record.messageId, updatedAt: record.updatedAt } });
});

router.get('/events', (_req, res) => {
  res.json({ data: listLyfeStackEvents() });
});

router.get('/events/stream', (req, res) => {
  if (!verifySecret(req)) {
    res.status(401).json({ error: 'invalid secret' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const emit = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  for (const event of listLyfeStackEvents(25).reverse()) {
    emit({ type: 'snapshot', event });
  }

  const unsubscribe = subscribeLyfeStackEvents((event) => emit({ type: 'event', event }));
  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

export { router as lyfestackRouter };
