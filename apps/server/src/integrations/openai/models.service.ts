import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { OPENCLAW_HOME } from '../openclaw/openclaw-json';
import { openaiJson } from './openai-client';
import { readConfig, resolveApiKey } from './model-registry';

const CACHE_DIR = path.join(OPENCLAW_HOME, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'openai-models.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface OpenAIModel {
  id: string;
  created?: number;
  owned_by?: string;
}

interface CachedModels {
  fetchedAt: number;
  models: OpenAIModel[];
}

interface ModelsResponse {
  data: OpenAIModel[];
}

async function readCache(): Promise<CachedModels | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as CachedModels;
  } catch {
    return null;
  }
}

async function writeCache(payload: CachedModels): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2));
}

export async function listModels(forceRefresh = false): Promise<OpenAIModel[]> {
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.models;
    }
  }

  const cfg = await readConfig();
  const apiKey = resolveApiKey(cfg);
  if (!apiKey) {
    logger.warn('OpenAI API key missing — returning cached models (possibly stale) or empty');
    const cached = await readCache();
    return cached?.models ?? [];
  }

  try {
    const res = await openaiJson<ModelsResponse>({ path: '/models', apiKey });
    const models = res.data.sort((a, b) => a.id.localeCompare(b.id));
    await writeCache({ fetchedAt: Date.now(), models });
    return models;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to list OpenAI models');
    const cached = await readCache();
    return cached?.models ?? [];
  }
}
