import { resolveModel } from './model-registry';
import { openaiBuffer } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';

export interface TtsOptions {
  voice?: string;
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

/**
 * Synthesize speech via /v1/audio/speech. Returns the raw audio buffer in the
 * requested format. The OpenAI TTS endpoint is non-streaming today, so we
 * round-trip the whole file.
 */
export async function synthesize(text: string, opts: TtsOptions = {}): Promise<{ buffer: Buffer; format: string; model: string; voice: string }> {
  if (!text.trim()) throw new Error('text required');
  await checkBudget();
  const resolved = await resolveModel('tts');
  const voice = opts.voice ?? resolved.voice ?? 'alloy';
  const format = opts.format ?? 'mp3';

  const buffer = await openaiBuffer({
    path: '/audio/speech',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: {
      model: resolved.model,
      input: text.slice(0, 4096),
      voice,
      response_format: format,
      ...(opts.speed ? { speed: opts.speed } : {}),
    },
  });

  return { buffer, format, model: resolved.model, voice };
}
