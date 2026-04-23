import { Router, type Request, type Response, type NextFunction } from 'express';
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

export { router as openaiRoutes };
