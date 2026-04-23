import { Router, type Request, type Response, type NextFunction, raw as rawBody } from 'express';
import { z } from 'zod';
import {
  getRedactedConfig,
  patchConfig,
  resolveModel,
  type ConfigPatch,
} from './model-registry';
import { listModels } from './models.service';
import { openaiJson } from './openai-client';
import { OPENAI_FEATURES, type OpenAIFeature } from './types';
import { transcribe } from './whisper.service';
import { automationFromTranscript } from './summary.service';
import { orchestrate } from './orchestrator.service';
import { analyze as analyzeImage } from './vision.service';
import { check as checkModeration } from './moderation.service';

const featureEnum = z.enum(OPENAI_FEATURES);

const featurePatchSchema = z.object({
  model: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
});

const configPatchSchema = z.object({
  defaultModel: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  budget: z
    .object({
      dailyUsd: z.number().nonnegative().optional(),
      monthlyUsd: z.number().nonnegative().optional(),
      hardStop: z.boolean().optional(),
    })
    .optional(),
  features: z.record(featureEnum, featurePatchSchema).optional(),
});

const router = Router();

router.get('/config', async (_req, res, next) => {
  try {
    res.json({ data: await getRedactedConfig() });
  } catch (err) {
    next(err);
  }
});

router.patch('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = configPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid config patch', issues: parsed.error.format() });
      return;
    }
    const updated = await patchConfig(parsed.data as ConfigPatch);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/models', async (req, res, next) => {
  try {
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    res.json({ data: await listModels(refresh) });
  } catch (err) {
    next(err);
  }
});

router.get('/features', (_req, res) => {
  res.json({ data: OPENAI_FEATURES });
});

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  model?: string;
}

router.post('/features/:name/test', async (req, res, next) => {
  try {
    const name = req.params.name as OpenAIFeature;
    if (!OPENAI_FEATURES.includes(name)) {
      res.status(400).json({ error: 'Unknown feature' });
      return;
    }
    const resolved = await resolveModel(name);

    if (name === 'embeddings') {
      const result = await openaiJson<EmbeddingResponse>({
        path: '/embeddings',
        method: 'POST',
        apiKey: resolved.apiKey,
        body: { model: resolved.model, input: 'ping' },
      });
      res.json({
        data: {
          ok: true,
          model: result.model ?? resolved.model,
          dimensions: result.data?.[0]?.embedding?.length ?? 0,
        },
      });
      return;
    }

    if (name === 'moderation') {
      const result = await openaiJson<{ results?: Array<{ flagged: boolean }> }>({
        path: '/moderations',
        method: 'POST',
        apiKey: resolved.apiKey,
        body: { model: resolved.model, input: 'hello world' },
      });
      res.json({
        data: { ok: true, model: resolved.model, flagged: result.results?.[0]?.flagged ?? false },
      });
      return;
    }

    if (name === 'voice' || name === 'tts' || name === 'whisper' || name === 'batch') {
      // These features need media/file inputs; defer to feature-specific test routes.
      res.json({
        data: { ok: true, model: resolved.model, note: 'configuration valid; live test from feature surface' },
      });
      return;
    }

    // summary / vision / orchestrator: simple chat ping
    const result = await openaiJson<CompletionResponse>({
      path: '/chat/completions',
      method: 'POST',
      apiKey: resolved.apiKey,
      body: {
        model: resolved.model,
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        max_tokens: 5,
      },
    });
    res.json({
      data: {
        ok: true,
        model: result.model ?? resolved.model,
        sample: result.choices?.[0]?.message?.content ?? '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Whisper ─────────────────────────────────────────────────────────────────

router.post(
  '/whisper',
  rawBody({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }),
  async (req, res, next) => {
    try {
      const buf = req.body as Buffer;
      if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ error: 'audio body required (raw bytes)' });
        return;
      }
      const filename = typeof req.query.filename === 'string' ? req.query.filename : 'audio.m4a';
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const opts: { filename: string; language?: string } = { filename };
      if (language) opts.language = language;
      const result = await transcribe(buf, opts);
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// ── Draft automation from transcript ────────────────────────────────────────

const draftSchema = z.object({
  transcript: z.string().min(1),
  availableAgents: z.array(z.string()).optional(),
  userTimezone: z.string().optional(),
});

router.post('/draft-automation', async (req, res, next) => {
  try {
    const parsed = draftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const ctx: { availableAgents: string[]; userTimezone?: string } = {
      availableAgents: parsed.data.availableAgents ?? [],
    };
    if (parsed.data.userTimezone) ctx.userTimezone = parsed.data.userTimezone;
    const draft = await automationFromTranscript(parsed.data.transcript, ctx);
    res.json({ data: draft });
  } catch (err) { next(err); }
});

// ── Natural-language orchestrator ───────────────────────────────────────────

const orchestrateSchema = z.object({
  prompt: z.string().min(1),
  history: z
    .array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }))
    .optional(),
});

router.post('/orchestrate', async (req, res, next) => {
  const parsed = orchestrateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const write = (payload: Record<string, unknown>) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  try {
    for await (const event of orchestrate(parsed.data.prompt, parsed.data.history ?? [])) {
      if (clientGone) return;
      write({ type: event.type, ...event.data });
      if (event.type === 'done' || event.type === 'error') {
        res.end();
        return;
      }
    }
    if (!clientGone) res.end();
  } catch (err: any) {
    if (!res.headersSent) { next(err); return; }
    write({ type: 'error', message: err?.message ?? 'orchestrator failed' });
    res.end();
  }
});

// ── Vision ─────────────────────────────────────────────────────────────────

const visionSchema = z.object({
  prompt: z.string().min(1),
  imageUrl: z.string().url().optional(),
  mediaId: z.string().min(1).optional(),
}).refine((d) => d.imageUrl || d.mediaId, { message: 'imageUrl or mediaId required' });

router.post('/vision', async (req, res, next) => {
  try {
    const parsed = visionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const input: { prompt: string; imageUrl?: string; mediaId?: string } = { prompt: parsed.data.prompt };
    if (parsed.data.imageUrl) input.imageUrl = parsed.data.imageUrl;
    if (parsed.data.mediaId) input.mediaId = parsed.data.mediaId;
    const result = await analyzeImage(input);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── Moderation ─────────────────────────────────────────────────────────────

router.post('/moderate', async (req, res, next) => {
  try {
    const input = typeof req.body?.input === 'string' ? req.body.input : '';
    if (!input) { res.status(400).json({ error: 'input required' }); return; }
    res.json({ data: await checkModeration(input) });
  } catch (err) { next(err); }
});

export { router as openaiRoutes };
