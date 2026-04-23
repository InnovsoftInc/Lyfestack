import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

const AUTOMATION_DRAFT_SCHEMA = {
  name: 'automation_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', description: 'Short human-readable name' },
      schedule: {
        type: 'string',
        description: 'Cron expression OR a natural-language phrase like "every weekday at 9am"',
      },
      agent: { type: 'string', description: 'Which OpenClaw agent should run this' },
      prompt: { type: 'string', description: 'The instruction the agent will execute on each run' },
      enabled: { type: 'boolean' },
      notifyChannel: { type: ['string', 'null'], description: 'optional notification channel' },
      rationale: { type: 'string', description: 'One-sentence explanation of what this automation does' },
    },
    required: ['name', 'schedule', 'agent', 'prompt', 'enabled', 'notifyChannel', 'rationale'],
  },
};

export interface AutomationDraft {
  name: string;
  schedule: string;
  agent: string;
  prompt: string;
  enabled: boolean;
  notifyChannel: string | null;
  rationale: string;
}

export async function automationFromTranscript(
  transcript: string,
  context: { availableAgents: string[]; userTimezone?: string },
): Promise<AutomationDraft> {
  await checkBudget();
  const resolved = await resolveModel('summary');
  const sys = `You convert a voice memo into a structured automation draft for OpenClaw.
Pick the most appropriate agent from: ${context.availableAgents.join(', ') || 'main'}.
Express schedules as cron when the user is specific (e.g. "every weekday at 9 → 0 9 * * 1-5").
If the user is vague, use a sensible cron and note it in rationale.
${context.userTimezone ? `User timezone: ${context.userTimezone}.` : ''}`;

  const result = await openaiJson<ChatResponse>({
    path: '/chat/completions',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: {
      model: resolved.model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: AUTOMATION_DRAFT_SCHEMA },
      temperature: 0.2,
    },
  });
  const content = result.choices?.[0]?.message?.content ?? '{}';
  let parsed: Partial<AutomationDraft>;
  try { parsed = JSON.parse(content); }
  catch { throw new Error('Model returned invalid JSON'); }
  return {
    name: parsed.name ?? 'New automation',
    schedule: parsed.schedule ?? '0 9 * * *',
    agent: parsed.agent ?? (context.availableAgents[0] ?? 'main'),
    prompt: parsed.prompt ?? transcript,
    enabled: parsed.enabled ?? false,
    notifyChannel: parsed.notifyChannel ?? null,
    rationale: parsed.rationale ?? '',
  };
}

export interface OneSentenceOptions {
  maxWords?: number;
}

export async function summarizeOneSentence(text: string, opts: OneSentenceOptions = {}): Promise<string> {
  if (!text.trim()) return '';
  await checkBudget();
  const resolved = await resolveModel('summary');
  const max = opts.maxWords ?? 18;
  const result = await openaiJson<ChatResponse>({
    path: '/chat/completions',
    method: 'POST',
    apiKey: resolved.apiKey,
    body: {
      model: resolved.model,
      messages: [
        { role: 'system', content: `Summarize the input in ONE sentence, ${max} words or fewer. No preamble.` },
        { role: 'user', content: text.slice(0, 6000) },
      ],
      max_tokens: 80,
      temperature: 0.2,
    },
  });
  return (result.choices?.[0]?.message?.content ?? '').trim();
}
