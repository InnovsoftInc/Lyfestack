import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';

interface RealtimeSessionResponse {
  id: string;
  model: string;
  client_secret: { value: string; expires_at: number };
  voice: string;
  modalities: string[];
}

export interface MintedRealtimeSession {
  sessionId: string;
  clientSecret: string;
  expiresAt: number;
  model: string;
  voice: string;
  modalities: string[];
}

/**
 * Mint an ephemeral Realtime session token. The mobile client uses
 * `clientSecret` to open a WebRTC peer connection directly to OpenAI without
 * ever seeing our long-lived API key.
 */
export async function mintSession(opts: {
  voice?: string;
  instructions?: string;
} = {}): Promise<MintedRealtimeSession> {
  await checkBudget();
  const resolved = await resolveModel('voice');
  const voice = opts.voice ?? resolved.voice ?? 'alloy';

  const res = await openaiJson<RealtimeSessionResponse>({
    path: '/realtime/sessions',
    method: 'POST',
    apiKey: resolved.apiKey,
    headers: { 'OpenAI-Beta': 'realtime=v1' },
    body: {
      model: resolved.model,
      voice,
      modalities: ['text', 'audio'],
      ...(opts.instructions ? { instructions: opts.instructions } : {}),
    },
  });

  return {
    sessionId: res.id,
    clientSecret: res.client_secret.value,
    expiresAt: res.client_secret.expires_at,
    model: res.model,
    voice: res.voice,
    modalities: res.modalities,
  };
}
