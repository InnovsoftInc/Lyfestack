import { resolveModel } from './model-registry';
import { openaiJson } from './openai-client';
import { checkBudget } from '../openclaw/usage-tracker';
import { check as moderate } from './moderation.service';
import { logger } from '../../utils/logger';
import { OpenClawService } from '../openclaw/openclaw.service';
import { listSessions, getSession } from '../openclaw/sessions.service';
import { getUsageSummary, getBudgetStatus } from '../openclaw/usage-tracker';
import { listQueue } from '../openclaw/delivery-queue.service';
import { listLogs, tailLog } from '../openclaw/logs.service';
import { listMedia } from '../openclaw/media.service';
import { listPending as listPendingApprovals, listAllowlist } from '../openclaw/approvals.service';
import { automationsService } from '../../automations/automations.service';

const openclaw = new OpenClawService();

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties: false;
    };
  };
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_agents',
      description: 'List all OpenClaw agents with their roles and current status.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent',
      description: 'Fetch detail for one agent by name.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_sessions',
      description: 'List recent chat sessions for an agent (or globally if agentId omitted).',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_session',
      description: 'Fetch up to 50 messages from a session by its key.',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' }, limit: { type: 'number' } },
        required: ['key'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_automations',
      description: 'List configured automations / routines (cron jobs, hooks, heartbeats).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_automation_now',
      description: 'Trigger a one-shot run of an automation by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_automation',
      description: 'Enable or disable an automation by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, enabled: { type: 'boolean' } },
        required: ['id', 'enabled'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_usage_summary',
      description: 'Return today/week/month usage totals (requests, tokens, estimated USD cost).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_status',
      description: 'Return daily/monthly OpenAI spend vs. configured budget.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_logs',
      description: 'List log files in ~/.openclaw/logs with size + mtime.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tail_log',
      description: 'Fetch the last N bytes (default 8KB, max 256KB) of a log file.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, bytes: { type: 'number' } },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_delivery_queue',
      description: 'List pending/failed/sent items in the OpenClaw delivery queue.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_media',
      description: 'List recent media artifacts (browser screenshots, inbound files).',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['browser', 'inbound', 'other'] },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_approvals',
      description: 'List exec commands awaiting human approval (best-effort log scan).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_allowlist',
      description: 'List approved exec patterns per agent.',
      parameters: {
        type: 'object',
        properties: { agent: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_skills',
      description: 'List installed OpenClaw skills.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

interface ToolArgs { [key: string]: unknown }

async function executeTool(name: string, args: ToolArgs): Promise<unknown> {
  switch (name) {
    case 'list_agents': return openclaw.listAgents();
    case 'get_agent': return openclaw.getAgent(args.name as string);
    case 'list_sessions': return listSessions({
      ...(typeof args.agentId === 'string' ? { agentId: args.agentId } : {}),
      limit: typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 50) : 20,
    });
    case 'get_session': return getSession(args.key as string, {
      limit: typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 50) : 25,
    });
    case 'list_automations': return automationsService.list();
    case 'run_automation_now': return automationsService.runNow(args.id as string);
    case 'toggle_automation': return automationsService.toggle(args.id as string, Boolean(args.enabled));
    case 'get_usage_summary': return getUsageSummary();
    case 'get_budget_status': return getBudgetStatus();
    case 'list_logs': return listLogs();
    case 'tail_log': return tailLog(args.name as string, typeof args.bytes === 'number' ? args.bytes : undefined);
    case 'list_delivery_queue': return listQueue();
    case 'list_media': {
      const opts: { source?: 'browser' | 'inbound' | 'other'; limit?: number } = {};
      if (args.source === 'browser' || args.source === 'inbound' || args.source === 'other') opts.source = args.source;
      if (typeof args.limit === 'number') opts.limit = args.limit;
      return listMedia(opts);
    }
    case 'list_pending_approvals': return listPendingApprovals();
    case 'list_allowlist': return listAllowlist(typeof args.agent === 'string' ? args.agent : undefined);
    case 'list_skills': return openclaw.listSkills();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const SYSTEM_PROMPT = `You are the OpenClaw remote console. The user controls a personal AI daemon via natural language; you call tools to inspect state and take action on their behalf.

Guidelines:
- Use tools to read state before answering — never guess.
- For "what's happening" questions, call multiple read tools in parallel.
- For mutation tools (run_automation_now, toggle_automation), confirm the user's intent in your reply unless they were explicit.
- Reply in plain conversational text, with short bullet lists for multi-item answers.
- Surface failures honestly. If a tool errors, say what went wrong.`;

export interface OrchestratorEvent {
  type: 'init' | 'tool_call' | 'tool_result' | 'delta' | 'done' | 'error';
  data: Record<string, unknown>;
}

type UserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ChatMessageOut {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | UserContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OrchestratorAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  textContent?: string | undefined;
  dataBase64?: string | undefined;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: ChatMessageOut;
    finish_reason: string;
  }>;
}

const MAX_ROUNDS = 6;

export async function* orchestrate(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  attachments: OrchestratorAttachment[] = [],
): AsyncGenerator<OrchestratorEvent> {
  await checkBudget();
  const mod = await moderate(prompt);
  if (mod.flagged) {
    yield { type: 'error', data: { message: `Input flagged by moderation (${mod.topCategory ?? 'policy'})`, moderation: mod } };
    return;
  }
  const resolved = await resolveModel('orchestrator');
  yield { type: 'init', data: { model: resolved.model } };

  const textAttachments = attachments.filter((a) => (a.type === 'text' || a.type === 'file') && a.textContent);
  const imageAttachments = attachments.filter((a) => a.type === 'image' && a.dataBase64);

  const promptWithText = textAttachments.length
    ? [
        prompt,
        ...textAttachments.map((a) => `\n\n[Attached file: ${a.name}]\n${a.textContent ?? ''}`),
      ].join('')
    : prompt;

  const userContent: string | UserContentPart[] = imageAttachments.length
    ? [
        { type: 'text', text: promptWithText },
        ...imageAttachments.map<UserContentPart>((a) => ({
          type: 'image_url',
          image_url: { url: `data:${a.mimeType};base64,${a.dataBase64}` },
        })),
      ]
    : promptWithText;

  const messages: ChatMessageOut[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await openaiJson<ChatCompletionResponse>({
      path: '/chat/completions',
      method: 'POST',
      apiKey: resolved.apiKey,
      body: {
        model: resolved.model,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
      },
    });

    const choice = response.choices[0];
    if (!choice) {
      yield { type: 'error', data: { message: 'no choices returned from model' } };
      return;
    }

    const calls = choice.message.tool_calls ?? [];
    if (calls.length > 0) {
      messages.push(choice.message);
      for (const call of calls) {
        let parsedArgs: ToolArgs = {};
        try { parsedArgs = JSON.parse(call.function.arguments || '{}'); }
        catch { /* tolerate empty/malformed */ }
        yield { type: 'tool_call', data: { id: call.id, name: call.function.name, arguments: parsedArgs } };
        try {
          const result = await executeTool(call.function.name, parsedArgs);
          yield { type: 'tool_result', data: { id: call.id, name: call.function.name, result } };
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result ?? null).slice(0, 24_000),
          });
        } catch (err: any) {
          const message = err?.message ?? 'tool error';
          logger.warn({ tool: call.function.name, err: message }, 'orchestrator tool failed');
          yield { type: 'tool_result', data: { id: call.id, name: call.function.name, error: message } };
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
      continue;
    }

    const content = choice.message.content ?? '';
    if (content) yield { type: 'delta', data: { text: content } };
    yield { type: 'done', data: { response: content } };
    return;
  }

  yield { type: 'error', data: { message: `orchestrator exceeded ${MAX_ROUNDS} tool rounds` } };
}
