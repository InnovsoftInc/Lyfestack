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
import { synthesize as synthesizeSpeech } from './tts.service';
import { mintSession as mintRealtimeSession } from './realtime.service';
import { reindex as reindexSearch, search as searchIndex, getIndexStats, type SearchScope } from './search-index.service';
import { submitNightlyBatch, pollAndStoreBatch, getLatestBatchResult } from './batch.service';

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

// ── TTS ─────────────────────────────────────────────────────────────────────

const ttsSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  format: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).optional(),
  speed: z.number().min(0.25).max(4).optional(),
});

router.post('/tts', async (req, res, next) => {
  try {
    const parsed = ttsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const opts: { voice?: string; format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'; speed?: number } = {};
    if (parsed.data.voice) opts.voice = parsed.data.voice;
    if (parsed.data.format) opts.format = parsed.data.format;
    if (parsed.data.speed) opts.speed = parsed.data.speed;
    const result = await synthesizeSpeech(parsed.data.text, opts);
    const mime = result.format === 'mp3' ? 'audio/mpeg'
      : result.format === 'opus' ? 'audio/ogg'
      : result.format === 'aac' ? 'audio/aac'
      : result.format === 'flac' ? 'audio/flac'
      : result.format === 'wav' ? 'audio/wav'
      : 'audio/L16';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-OpenAI-Model', result.model);
    res.setHeader('X-OpenAI-Voice', result.voice);
    res.send(result.buffer);
  } catch (err) { next(err); }
});

// ── Realtime (ephemeral session mint) ──────────────────────────────────────

const realtimeSchema = z.object({
  voice: z.string().optional(),
  instructions: z.string().optional(),
});

router.post('/realtime/session', async (req, res, next) => {
  try {
    const parsed = realtimeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const opts: { voice?: string; instructions?: string } = {};
    if (parsed.data.voice) opts.voice = parsed.data.voice;
    if (parsed.data.instructions) opts.instructions = parsed.data.instructions;
    const session = await mintRealtimeSession(opts);
    res.json({ data: session });
  } catch (err) { next(err); }
});

// ── Semantic search ────────────────────────────────────────────────────────

const searchSchema = z.object({
  q: z.string().min(1),
  scopes: z.array(z.enum(['sessions', 'skills', 'memory'])).optional(),
  limit: z.number().min(1).max(30).optional(),
});

router.post('/search', async (req, res, next) => {
  try {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.format() });
      return;
    }
    const opts: { q: string; scopes?: SearchScope[]; limit?: number } = { q: parsed.data.q };
    if (parsed.data.scopes) opts.scopes = parsed.data.scopes;
    if (parsed.data.limit) opts.limit = parsed.data.limit;
    res.json({ data: await searchIndex(opts) });
  } catch (err) { next(err); }
});

router.post('/search/reindex', async (req, res, next) => {
  try {
    const scopes = Array.isArray(req.body?.scopes) ? (req.body.scopes as SearchScope[]) : undefined;
    const stats = await reindexSearch(scopes);
    res.json({ data: stats });
  } catch (err) { next(err); }
});

router.get('/search/stats', (_req, res, next) => {
  try { res.json({ data: getIndexStats() }); } catch (err) { next(err); }
});

// ── Batch nightly report ────────────────────────────────────────────────────

router.post('/batch/run', async (_req, res, next) => {
  try { res.json({ data: await submitNightlyBatch() }); } catch (err) { next(err); }
});

router.post('/batch/poll/:id', async (req, res, next) => {
  try {
    if (!req.params.id) { res.status(400).json({ error: 'id required' }); return; }
    const result = await pollAndStoreBatch(req.params.id);
    if (!result) { res.status(202).json({ data: { status: 'pending' } }); return; }
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/batch/latest', async (_req, res, next) => {
  try {
    const latest = await getLatestBatchResult();
    if (!latest) { res.status(404).json({ error: 'no batch result yet' }); return; }
    res.json({ data: latest });
  } catch (err) { next(err); }
});

export { router as openaiRoutes };
