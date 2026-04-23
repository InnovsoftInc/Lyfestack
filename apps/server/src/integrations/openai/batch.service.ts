import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveModel } from './model-registry';
import { openaiFetch, openaiJson } from './openai-client';
import { OPENCLAW_HOME } from '../openclaw/openclaw-json';
import { getUsageSummary, getUsageByAgent, getUsageByModel } from '../openclaw/usage-tracker';
import { logger } from '../../utils/logger';

const CACHE_DIR = path.join(OPENCLAW_HOME, 'cache');
const RESULT_FILE = path.join(CACHE_DIR, 'nightly-batch-result.json');

interface FileUploadResponse {
  id: string;
  bytes: number;
  filename: string;
  purpose: string;
}

interface BatchResponse {
  id: string;
  status: 'validating' | 'failed' | 'in_progress' | 'finalizing' | 'completed' | 'expired' | 'cancelling' | 'cancelled';
  output_file_id?: string;
  error_file_id?: string;
  created_at: number;
  request_counts?: { total: number; completed: number; failed: number };
}

interface NightlyResult {
  generatedAt: string;
  batchId: string;
  insights: string[];
}

async function uploadJsonl(jsonl: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([jsonl], { type: 'application/jsonl' }), 'batch.jsonl');
  form.append('purpose', 'batch');
  const res = await openaiJson<FileUploadResponse>({
    path: '/files',
    method: 'POST',
    apiKey,
    body: form,
  });
  return res.id;
}

async function downloadFile(fileId: string, apiKey: string): Promise<string> {
  const res = await openaiFetch({
    path: `/files/${fileId}/content`,
    apiKey,
  });
  return res.text();
}

interface ContextBundle {
  usage: Awaited<ReturnType<typeof getUsageSummary>>;
  byAgent: Awaited<ReturnType<typeof getUsageByAgent>>;
  byModel: Awaited<ReturnType<typeof getUsageByModel>>;
}

async function buildContext(): Promise<ContextBundle> {
  const [usage, byAgent, byModel] = await Promise.all([
    getUsageSummary(),
    getUsageByAgent(),
    getUsageByModel(),
  ]);
  return { usage, byAgent, byModel };
}

const PROMPTS = [
  { id: 'spend', system: 'You write a one-sentence summary of OpenClaw spend, calling out anything notable.' },
  { id: 'top_agents', system: 'You write a one-sentence summary of which agents were most active and why that matters.' },
  { id: 'risks', system: 'You write a one-sentence flag of any risks or anomalies in usage patterns. If none, say "No anomalies."' },
];

export async function submitNightlyBatch(): Promise<{ batchId: string }> {
  const resolved = await resolveModel('batch');
  const ctx = await buildContext();
  const userPayload = JSON.stringify(ctx).slice(0, 8000);

  const lines = PROMPTS.map((p) => JSON.stringify({
    custom_id: p.id,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model: resolved.model,
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: userPayload },
      ],
      max_tokens: 80,
    },
  })).join('\n');

  const fileId = await uploadJsonl(lines + '\n', resolved.apiKey);
  const batch = await openaiJson<BatchResponse>({
    path: '/batches',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: {
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    },
  });
  logger.info({ batchId: batch.id, prompts: PROMPTS.length }, 'nightly batch submitted');
  return { batchId: batch.id };
}

interface BatchResultLine {
  custom_id: string;
  response?: { body: { choices?: Array<{ message?: { content?: string } }> } };
  error?: { message: string };
}

export async function pollAndStoreBatch(batchId: string): Promise<NightlyResult | null> {
  const resolved = await resolveModel('batch');
  const status = await openaiJson<BatchResponse>({
    path: `/batches/${batchId}`,
    apiKey: resolved.apiKey,
  });
  if (status.status !== 'completed' || !status.output_file_id) {
    logger.info({ batchId, status: status.status }, 'nightly batch not yet complete');
    return null;
  }

  const text = await downloadFile(status.output_file_id, resolved.apiKey);
  const lines = text.split('\n').filter(Boolean);
  const insights: string[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as BatchResultLine;
      const content = parsed.response?.body.choices?.[0]?.message?.content?.trim();
      if (content) insights.push(content);
    } catch { /* skip */ }
  }

  const result: NightlyResult = {
    generatedAt: new Date().toISOString(),
    batchId,
    insights,
  };
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(RESULT_FILE, JSON.stringify(result, null, 2));
  logger.info({ batchId, insights: insights.length }, 'nightly batch stored');
  return result;
}

export async function getLatestBatchResult(): Promise<NightlyResult | null> {
  try {
    const raw = await fs.readFile(RESULT_FILE, 'utf-8');
    return JSON.parse(raw) as NightlyResult;
  } catch { return null; }
}
