import { openaiJson } from './openai-client';
import { AppError } from '../../errors/AppError';

interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
}

export interface TranscriptResult {
  text: string;
  language?: string;
  durationSec?: number;
  model: string;
}

const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1';

class TranscriptionConfigError extends AppError {
  constructor() {
    super(
      'Speech-to-text is not configured. Set OPENAI_API_KEY in the server environment.',
      503,
      'SPEECH_TO_TEXT_NOT_CONFIGURED',
    );
  }
}

function resolveTranscriptionConfig(): { apiKey: string; model: string } {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new TranscriptionConfigError();
  }
  return {
    apiKey,
    model: process.env['OPENAI_TRANSCRIPTION_MODEL'] ?? DEFAULT_TRANSCRIPTION_MODEL,
  };
}

/**
 * Transcribe an audio buffer via Whisper. The buffer should contain a
 * complete file in a Whisper-supported format (m4a, mp3, mp4, webm, wav,
 * mpga, ogg, flac).
 */
export async function transcribe(buffer: Buffer, opts: { filename?: string; language?: string } = {}): Promise<TranscriptResult> {
  const resolved = resolveTranscriptionConfig();
  const filename = opts.filename ?? 'audio.m4a';
  const mime =
    filename.endsWith('.mp3') ? 'audio/mpeg' :
    filename.endsWith('.wav') ? 'audio/wav' :
    filename.endsWith('.webm') ? 'audio/webm' :
    filename.endsWith('.ogg') ? 'audio/ogg' :
    filename.endsWith('.flac') ? 'audio/flac' :
    'audio/mp4';

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  form.append('model', resolved.model);
  form.append('response_format', 'verbose_json');
  if (opts.language) form.append('language', opts.language);

  const result = await openaiJson<TranscriptionResponse>({
    path: '/audio/transcriptions',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: form,
  });
  const out: TranscriptResult = { text: result.text, model: resolved.model };
  if (result.language) out.language = result.language;
  if (typeof result.duration === 'number') out.durationSec = result.duration;
  return out;
}
