import { request } from './api';

export const OPENAI_FEATURES = [
  'voice',
  'tts',
  'whisper',
  'vision',
  'embeddings',
  'moderation',
  'summary',
  'orchestrator',
  'batch',
] as const;

export type OpenAIFeature = (typeof OPENAI_FEATURES)[number];

export interface FeatureConfig {
  model: string;
  voice?: string;
}

export interface BudgetConfig {
  dailyUsd: number;
  monthlyUsd: number;
  hardStop: boolean;
}

export interface RedactedOpenAIConfig {
  hasApiKey: boolean;
  apiKeySource: string;
  defaultModel: string;
  features: Record<OpenAIFeature, FeatureConfig>;
  budget: BudgetConfig;
}

export interface OpenAIModel {
  id: string;
  created?: number;
  owned_by?: string;
}

export interface FeatureTestResult {
  ok: boolean;
  model: string;
  sample?: string;
  dimensions?: number;
  flagged?: boolean;
  note?: string;
}

export interface ConfigPatch {
  defaultModel?: string;
  apiKey?: string;
  budget?: Partial<BudgetConfig>;
  features?: Partial<Record<OpenAIFeature, Partial<FeatureConfig>>>;
}

export interface TranscriptResult {
  text: string;
  language?: string;
  durationSec?: number;
  model: string;
}

export interface AutomationDraft {
  name: string;
  schedule: string;
  agent: string;
  prompt: string;
  enabled: boolean;
  notifyChannel: string | null;
  rationale: string;
}

export const openaiApi = {
  getConfig: () =>
    request<{ data: RedactedOpenAIConfig }>('/api/openai/config').then((r) => r.data),

  patchConfig: (patch: ConfigPatch) =>
    request<{ data: RedactedOpenAIConfig }>('/api/openai/config', {
      method: 'PATCH',
      body: patch,
    }).then((r) => r.data),

  listModels: (refresh = false) =>
    request<{ data: OpenAIModel[] }>(`/api/openai/models${refresh ? '?refresh=1' : ''}`).then(
      (r) => r.data,
    ),

  listFeatures: () =>
    request<{ data: readonly OpenAIFeature[] }>('/api/openai/features').then((r) => r.data),

  testFeature: (feature: OpenAIFeature) =>
    request<{ data: FeatureTestResult }>(`/api/openai/features/${feature}/test`, {
      method: 'POST',
    }).then((r) => r.data),

  draftAutomation: (input: { transcript: string; availableAgents?: string[]; userTimezone?: string }) =>
    request<{ data: AutomationDraft }>('/api/openai/draft-automation', {
      method: 'POST',
      body: input,
    }).then((r) => r.data),

  vision: (input: { prompt: string; mediaId?: string; imageUrl?: string }) =>
    request<{ data: { answer: string; model: string } }>('/api/openai/vision', {
      method: 'POST',
      body: input,
    }).then((r) => r.data),

  moderate: (input: string) =>
    request<{ data: { flagged: boolean; topCategory?: string; topScore?: number; model: string } }>(
      '/api/openai/moderate',
      { method: 'POST', body: { input } },
    ).then((r) => r.data),
};

export const pushApi = {
  register: (token: string, device?: string) =>
    request<{ success: boolean }>('/api/push/register', {
      method: 'POST',
      body: { token, ...(device ? { device } : {}) },
    }),
};

export interface SearchHit {
  id: string;
  scope: 'sessions' | 'skills' | 'memory';
  source: string;
  snippet: string;
  score: number;
}

export const searchApi = {
  query: (q: string, scopes?: Array<'sessions' | 'skills' | 'memory'>, limit?: number) =>
    request<{ data: SearchHit[] }>('/api/openai/search', {
      method: 'POST',
      body: { q, ...(scopes ? { scopes } : {}), ...(limit ? { limit } : {}) },
    }).then((r) => r.data),

  reindex: (scopes?: Array<'sessions' | 'skills' | 'memory'>) =>
    request<{ data: { added: number; updated: number; removed: number; total: number; skipped: number } }>('/api/openai/search/reindex', {
      method: 'POST',
      body: scopes ? { scopes } : {},
    }).then((r) => r.data),

  stats: () =>
    request<{ data: { total: number; byScope: Record<string, number> } }>('/api/openai/search/stats').then((r) => r.data),
};

export interface RealtimeSession {
  sessionId: string;
  clientSecret: string;
  expiresAt: number;
  model: string;
  voice: string;
  modalities: string[];
}

export const realtimeApi = {
  mintSession: (opts?: { voice?: string; instructions?: string }) =>
    request<{ data: RealtimeSession }>('/api/openai/realtime/session', {
      method: 'POST',
      body: opts ?? {},
    }).then((r) => r.data),
};

/**
 * Fetch the binary TTS audio for `text`. Returns a base64 data URI suitable
 * for `expo-audio`'s createAudioPlayer.
 */
export async function fetchTtsDataUri(text: string, voice?: string): Promise<string> {
  const base = await getApiBase();
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/openai/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, ...(voice ? { voice } : {}), format: 'mp3' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `TTS failed: ${res.status}`);
  }
  const arr = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(arr);
  return `data:audio/mpeg;base64,${b64}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  // eslint-disable-next-line no-undef
  return globalThis.btoa(bin);
}

import { getApiBase, getAuthToken } from './api';

// ── Orchestrator (SSE) ─────────────────────────────────────────────────────

export type OrchestratorEvent =
  | { type: 'init'; model?: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result?: unknown; error?: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; response: string }
  | { type: 'error'; message: string };

export interface OrchestrateAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  textContent?: string;
  dataBase64?: string;
}

export interface OrchestrateOptions {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachments?: OrchestrateAttachment[];
  signal?: AbortSignal;
  onEvent: (ev: OrchestratorEvent) => void;
}

export async function streamOrchestrator(opts: OrchestrateOptions): Promise<void> {
  const base = await getApiBase();
  const token = await getAuthToken();
  const url = `${base}/api/openai/orchestrate`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    let processedLength = 0;
    let lineBuffer = '';
    let resolved = false;
    const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };
    const safeReject = (e: Error) => { if (!resolved) { resolved = true; reject(e); } };

    function processLines() {
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6)) as OrchestratorEvent;
          opts.onEvent(payload);
          if (payload.type === 'done' || payload.type === 'error') safeResolve();
        } catch { /* skip malformed */ }
      }
    }

    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      lineBuffer += newText;
      processLines();
    };
    xhr.onload = () => {
      if (xhr.status >= 400) {
        safeReject(new Error(`orchestrator error: ${xhr.status}`));
        return;
      }
      if (lineBuffer.trim()) { lineBuffer += '\n'; processLines(); }
      safeResolve();
    };
    xhr.onerror = () => safeReject(new Error('Network request failed'));
    xhr.ontimeout = () => safeReject(new Error('Request timed out'));

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => { xhr.abort(); safeResolve(); });
    }

    xhr.send(JSON.stringify({
      prompt: opts.prompt,
      history: opts.history ?? [],
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    }));
  });
}

/**
 * Send raw audio bytes to /api/openai/whisper. Uses fetch directly because
 * the standard `request` helper sends JSON only.
 */
export async function transcribeAudio(
  body: Uint8Array | ArrayBuffer | Blob,
  opts: { filename?: string; language?: string } = {},
): Promise<TranscriptResult> {
  const base = await getApiBase();
  const token = await getAuthToken();
  const qs: string[] = [];
  if (opts.filename) qs.push(`filename=${encodeURIComponent(opts.filename)}`);
  if (opts.language) qs.push(`language=${encodeURIComponent(opts.language)}`);
  const url = `${base}/api/openai/whisper${qs.length ? `?${qs.join('&')}` : ''}`;
  const headers: Record<string, string> = {
    'Content-Type': opts.filename?.endsWith('.wav') ? 'audio/wav'
      : opts.filename?.endsWith('.mp3') ? 'audio/mpeg'
      : opts.filename?.endsWith('.webm') ? 'audio/webm'
      : 'audio/mp4',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: body as any });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = '';
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message ?? '';
    } catch {}
    throw new Error(message || text || `transcription failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: TranscriptResult };
  return json.data;
}
