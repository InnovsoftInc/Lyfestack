import { ExternalServiceError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import { resolveModel, type ResolvedFeature } from './model-registry';
import type { OpenAIFeature } from './types';

const BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

export interface OpenAIRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown | FormData;
  headers?: Record<string, string>;
  apiKey: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function openaiFetch(req: OpenAIRequest): Promise<Response> {
  const url = req.path.startsWith('http') ? req.path : `${BASE_URL}${req.path}`;
  const isForm = typeof FormData !== 'undefined' && req.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${req.apiKey}`,
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...req.headers,
  };

  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('OpenAI request timed out')),
      req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (req.signal) {
      if (req.signal.aborted) controller.abort();
      else req.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const init: RequestInit = {
        method: req.method ?? 'GET',
        headers,
        signal: controller.signal,
      };
      if (req.body !== undefined) {
        init.body = isForm ? (req.body as FormData) : JSON.stringify(req.body);
      }
      const res = await fetch(url, init);
      clearTimeout(timeout);

      if (!res.ok && isRetryable(res.status) && attempt < MAX_RETRIES) {
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
        logger.warn(
          { status: res.status, attempt, backoff, path: req.path },
          'OpenAI request failed, retrying',
        );
        await delay(backoff);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt >= MAX_RETRIES) break;
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
      logger.warn({ err: (err as Error).message, attempt, backoff }, 'OpenAI fetch threw, retrying');
      await delay(backoff);
    }
  }

  throw new ExternalServiceError(
    'OpenAI',
    `request failed after ${MAX_RETRIES} attempts: ${(lastError as Error)?.message ?? 'unknown'}`,
  );
}

export async function openaiJson<T>(req: OpenAIRequest): Promise<T> {
  const res = await openaiFetch(req);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ExternalServiceError('OpenAI', `HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export async function openaiBuffer(req: OpenAIRequest): Promise<Buffer> {
  const res = await openaiFetch(req);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ExternalServiceError('OpenAI', `HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * Open an SSE stream and yield each `data:` payload as a parsed JSON object.
 * Yields the literal string 'DONE' for the terminating `[DONE]` sentinel.
 */
export async function* openaiStream(req: OpenAIRequest): AsyncGenerator<unknown> {
  const res = await openaiFetch({ ...req, method: req.method ?? 'POST' });
  if (!res.ok || !res.body) {
    const text = res.body ? await res.text().catch(() => '') : '';
    throw new ExternalServiceError('OpenAI', `stream HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') {
        yield 'DONE';
        return;
      }
      try {
        yield JSON.parse(payload);
      } catch {
        // skip malformed
      }
    }
  }
}

export async function withFeature<T>(
  feature: OpenAIFeature,
  fn: (resolved: ResolvedFeature) => Promise<T>,
): Promise<T> {
  const resolved = await resolveModel(feature);
  return fn(resolved);
}
