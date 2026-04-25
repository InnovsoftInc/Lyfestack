import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { trackUsage } from './usage-tracker';
import { OPENCLAW_HOME, OPENCLAW_JSON, readOpenclawJson as sharedRead, writeOpenclawJson as sharedWrite } from './openclaw-json';
const OPENCLAW_CONFIG = OPENCLAW_HOME;
const WORKSPACE = path.join(OPENCLAW_CONFIG, 'workspace');
const SKILLS_DIR = path.join(OPENCLAW_CONFIG, 'skills');
const CHAT_UPLOADS_DIR = path.join(OPENCLAW_CONFIG, 'chat-uploads');
const DEFAULT_AGENT_MODEL = 'openai-codex/gpt-5.2-codex';
const AGENT_TIMEOUT_MS = Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS ?? 1_800_000);
const AGENT_TIMEOUT_LABEL = `${Math.round(AGENT_TIMEOUT_MS / 60_000)} minutes`;

// Core identity files every agent shares
const SHARED_FILES = ['IDENTITY.md', 'SOUL.md', 'ROLES.md', 'USER.md', 'AGENTS.md'];

export interface AgentFile {
  filename: string;
  type: 'identity' | 'shared';
  preview: string;
  size: number;
  modifiedAt: string;
}

export interface OpenClawConfig {
  gateway: {
    port: number;
    mode: string;
    bind: string;
  };
  agentDefaults: {
    primaryModel: string;
    fallbackModels: string[];
  };
  codingTool: string;
  availableModels: string[];
  availableModelDetails: Array<{
    id: string;
    reasoning: boolean;
    contextWindow: number;
    maxTokens: number;
  }>;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface AuthProfileInfo {
  name: string;
  provider: string;
  mode: string;
  maskedKey?: string;
  envVar?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  size: number;
  modifiedAt: string;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

export interface OpenClawAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  fallbackModels?: string[];
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
}

export interface MessageAttachmentInput {
  id?: string;
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  textContent?: string;
  dataBase64?: string;
}

interface PreparedAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  uri?: string;
}

function sanitizeFilename(name: string): string {
  const trimmed = String(name || 'attachment').trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return safe.slice(0, 120) || 'attachment';
}

function isTextLikeAttachment(mimeType: string, name: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = name.toLowerCase();
  return lowerMime.startsWith('text/')
    || lowerMime.includes('json')
    || lowerMime.includes('xml')
    || lowerMime.includes('yaml')
    || lowerMime.includes('csv')
    || lowerMime.includes('javascript')
    || lowerMime.includes('typescript')
    || /\.(txt|md|mdx|json|ya?ml|csv|ts|tsx|js|jsx|html|css|xml|log)$/i.test(lowerName);
}

async function prepareMessageWithAttachments(agentName: string, message: string, attachments: MessageAttachmentInput[] = []): Promise<{ prompt: string; attachments: PreparedAttachment[] }> {
  if (!attachments.length) return { prompt: message, attachments: [] };

  const dir = path.join(CHAT_UPLOADS_DIR, agentName, new Date().toISOString().slice(0, 10));
  await fs.mkdir(dir, { recursive: true });

  const saved: PreparedAttachment[] = [];
  const promptSections: string[] = [];

  for (const attachment of attachments) {
    const id = String(attachment.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const safeName = sanitizeFilename(attachment.name);
    const filePath = path.join(dir, `${id}-${safeName}`);
    const mimeType = String(attachment.mimeType ?? 'application/octet-stream');
    const type = attachment.type === 'image' ? 'image' : attachment.type === 'text' ? 'text' : 'file';
    const textLike = type === 'text' || isTextLikeAttachment(mimeType, safeName);

    let buffer: Buffer | null = null;
    if (typeof attachment.dataBase64 === 'string' && attachment.dataBase64.length > 0) {
      buffer = Buffer.from(attachment.dataBase64, 'base64');
    } else if (typeof attachment.textContent === 'string') {
      buffer = Buffer.from(attachment.textContent, 'utf-8');
    }

    if (buffer) await fs.writeFile(filePath, buffer);
    else await fs.writeFile(filePath, '');

    saved.push({
      id,
      name: attachment.name,
      type,
      mimeType,
      size: Number(attachment.size ?? buffer?.length ?? 0) || 0,
      uri: filePath,
    });

    if (textLike) {
      const textContent = typeof attachment.textContent === 'string'
        ? attachment.textContent
        : (buffer ? buffer.toString('utf-8') : '');
      const trimmed = textContent.trim();
      const excerpt = trimmed.length > 12_000 ? `${trimmed.slice(0, 12_000)}\n...[truncated]` : trimmed;
      promptSections.push(`<context file="${attachment.name}" mimeType="${mimeType}" path="${filePath}">\n${excerpt}\n</context>`);
    } else {
      promptSections.push(`<attachment file="${attachment.name}" mimeType="${mimeType}" path="${filePath}" note="Binary attachment saved locally. Use tools if you need to inspect it." />`);
    }
  }

  const prompt = [
    '[Internal attachment context for the agent only. Do not quote, reveal, or reproduce this block in your reply. Use it only to understand the user\'s attached files.]',
    ...promptSections,
    '[End internal attachment context. Reply naturally to the user\'s message below.]',
    message || 'Please review the attached file(s).',
  ].filter(Boolean).join('\n\n');

  return { prompt, attachments: saved };
}

async function readOpenclawJson(): Promise<any> {
  return sharedRead<any>();
}

async function writeOpenclawJson(data: any): Promise<void> {
  await sharedWrite(data);
}

export async function resolveOpenClawAgentId(input: string): Promise<string> {
  const requested = input.trim();
  if (!requested) return input;
  try {
    const config = await readOpenclawJson();
    const list: Array<{ id: string; name?: string }> = config?.agents?.list ?? [];
    const exactId = list.find((entry) => entry.id === requested);
    if (exactId) return exactId.id;
    const lower = requested.toLowerCase();
    const match = list.find((entry) =>
      entry.id.toLowerCase() === lower || (entry.name ?? '').toLowerCase() === lower,
    );
    return match?.id ?? requested;
  } catch (err) {
    logger.warn({ err, agent: input }, 'agent id resolution failed');
    return requested;
  }
}


type GatewayClientDeps = {
  GatewayClient: new (opts: any) => {
    start: () => void;
    stop: () => void;
    request: (method: string, params: Record<string, unknown>, opts?: { timeoutMs?: number | null }) => Promise<unknown>;
    onEvent?: ((evt: { event: string; payload: any; seq: number }) => void) | undefined;
  };
  GATEWAY_CLIENT_NAMES: { GATEWAY_CLIENT: string };
  GATEWAY_CLIENT_MODES: { BACKEND: string };
  GATEWAY_CLIENT_CAPS: { TOOL_EVENTS: string };
};

let gatewayClientDepsPromise: Promise<GatewayClientDeps> | null = null;

async function loadGatewayClientDeps(): Promise<GatewayClientDeps> {
  if (!gatewayClientDepsPromise) {
    gatewayClientDepsPromise = (async () => {
      const [clientMod, msgMod] = await Promise.all([
        eval('import("file:///opt/homebrew/lib/node_modules/openclaw/dist/client-BXqqdOmk.js")') as Promise<any>,
        eval('import("file:///opt/homebrew/lib/node_modules/openclaw/dist/message-channel-CMzhST9r.js")') as Promise<any>,
      ]);
      return {
        GatewayClient: clientMod.t,
        GATEWAY_CLIENT_NAMES: msgMod.g,
        GATEWAY_CLIENT_MODES: msgMod.h,
        GATEWAY_CLIENT_CAPS: msgMod.p,
      };
    })();
  }
  return gatewayClientDepsPromise;
}

async function resolveGatewayWsUrl(): Promise<string> {
  try {
    const cfg = await readOpenclawJson();
    const remoteUrl = typeof cfg?.gateway?.remote?.url === 'string' ? cfg.gateway.remote.url.trim() : '';
    if (remoteUrl) return remoteUrl;
    const portValue = Number(cfg?.gateway?.port ?? process.env.OPENCLAW_GATEWAY_PORT ?? 18789);
    const port = Number.isFinite(portValue) ? portValue : 18789;
    return `ws://127.0.0.1:${port}`;
  } catch {
    const portValue = Number(process.env.OPENCLAW_GATEWAY_PORT ?? 18789);
    const port = Number.isFinite(portValue) ? portValue : 18789;
    return `ws://127.0.0.1:${port}`;
  }
}

function extractGatewayMessageText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (!message || typeof message !== 'object') return '';
  const entry = message as Record<string, unknown>;
  if (typeof entry.text === 'string') return entry.text;
  if (typeof entry.content === 'string') return entry.content;
  if (!Array.isArray(entry.content)) return '';
  return entry.content
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      const item = block as Record<string, unknown>;
      if (item.type !== 'text' || typeof item.text !== 'string') return '';
      return item.text;
    })
    .filter(Boolean)
    .join('');
}

export class OpenClawService {
  private async requestGateway<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const { GatewayClient, GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_CAPS } = await loadGatewayClientDeps();
    const gatewayUrl = await resolveGatewayWsUrl();

    let readyResolved = false;
    let readyResolve!: () => void;
    let readyReject!: (err: Error) => void;
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = () => {
        if (readyResolved) return;
        readyResolved = true;
        resolve();
      };
      readyReject = (err: Error) => {
        if (readyResolved) return;
        readyResolved = true;
        reject(err);
      };
    });

    const client = new GatewayClient({
      url: gatewayUrl,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: 'lyfestack',
      clientVersion: '0.0.1',
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      minProtocol: 3,
      maxProtocol: 3,
      onHelloOk: () => readyResolve(),
      onConnectError: (err: Error) => {
        readyReject(err);
      },
      onClose: (_code: number, reason: string) => {
        if (!readyResolved) {
          readyReject(new Error(reason || 'gateway closed'));
        }
      },
      onEvent: () => {},
    });

    try {
      client.start();
      await readyPromise;
      return await client.request(method, params) as T;
    } finally {
      client.stop();
    }
  }

  private buildAgentArgs(agentName: string, message: string, sessionKey?: string | null): string[] {
    const args = ['agent', '--agent', agentName];
    if (sessionKey) args.push('--session-id', sessionKey);
    args.push('-m', message);
    return args;
  }


  private async sendMessageStreamGateway(
    agentName: string,
    message: string,
    attachments: MessageAttachmentInput[] = [],
    sessionKey: string | null | undefined,
    onChunk: (chunk: string) => void,
    onDone: (full: string) => void,
    onError: (err: Error) => void,
    onToolUse?: (toolName: string, phase?: 'use' | 'result') => void,
  ): Promise<void> {
    const startTime = Date.now();
    const prepared = await prepareMessageWithAttachments(agentName, message, attachments);
    const { GatewayClient, GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_CAPS } = await loadGatewayClientDeps();
    const gatewayUrl = await resolveGatewayWsUrl();
    const runId = randomUUID();
    const expectedSessionKey = sessionKey ?? null;

    let readyResolved = false;
    let readyResolve!: () => void;
    let readyReject!: (err: Error) => void;
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = () => {
        if (readyResolved) return;
        readyResolved = true;
        resolve();
      };
      readyReject = (err: Error) => {
        if (readyResolved) return;
        readyResolved = true;
        reject(err);
      };
    });

    let resolved = false;
    let resolveFinal!: () => void;
    let rejectFinal!: (err: Error) => void;
    const finalPromise = new Promise<void>((resolve, reject) => {
      resolveFinal = resolve;
      rejectFinal = reject;
    });

    let accumulated = '';
    const client = new GatewayClient({
      url: gatewayUrl,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: 'lyfestack',
      clientVersion: '0.0.1',
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      minProtocol: 3,
      maxProtocol: 3,
      onHelloOk: () => readyResolve(),
      onConnectError: (err: Error) => {
        if (!readyResolved) {
          readyReject(err);
          return;
        }
        if (resolved) return;
        resolved = true;
        rejectFinal(err);
      },
      onClose: (_code: number, reason: string) => {
        if (!readyResolved) {
          readyReject(new Error(reason || 'gateway closed'));
          return;
        }
        if (resolved) return;
        resolved = true;
        rejectFinal(new Error(reason || 'gateway closed'));
      },
      onEvent: (evt: { event: string; payload: any; seq: number }) => {
        if (resolved) return;
        if (evt.event === 'chat') {
          const payload = evt.payload ?? {};
          if (typeof payload.runId === 'string' && payload.runId !== runId) return;
          const state = typeof payload.state === 'string' ? payload.state : '';
          if (state === 'delta') {
            const nextText = extractGatewayMessageText(payload.message);
            if (nextText) {
              let chunk = nextText;
              if (nextText.startsWith(accumulated)) {
                chunk = nextText.slice(accumulated.length);
                accumulated = nextText;
              } else {
                accumulated += nextText;
              }
              if (chunk) onChunk(chunk);
            }
            return;
          }
          if (state === 'final') {
            const finalText = extractGatewayMessageText(payload.message) || accumulated;
            resolved = true;
            onDone(finalText);
            resolveFinal();
            return;
          }
          if (state === 'aborted') {
            resolved = true;
            const err = new Error('agent aborted');
            onError(err);
            rejectFinal(err);
            return;
          }
          if (state === 'error') {
            const errMessage = typeof payload.errorMessage === 'string' ? payload.errorMessage : 'agent error';
            const err = new Error(errMessage);
            resolved = true;
            onError(err);
            rejectFinal(err);
          }
          return;
        }

        if (evt.event === 'agent') {
          const payload = evt.payload ?? {};
          if (typeof payload.runId === 'string' && payload.runId !== runId) return;
          if (payload.stream !== 'tool') return;
          const data = payload.data ?? {};
          const phase = typeof data.phase === 'string' ? data.phase : '';
          const toolCallId = typeof data.toolCallId === 'string' ? data.toolCallId : '';
          const toolName = typeof data.name === 'string' ? data.name : 'tool';
          if (!toolCallId) return;
          if (phase === 'start') onToolUse?.(toolName, 'use');
          else if (phase === 'result') onToolUse?.(toolName, 'result');
          else if (phase === 'error') onToolUse?.(toolName, 'result');
        }
      },
    });

    try {
      client.start();
      await readyPromise;
      await client.request('chat.send', {
        sessionKey: expectedSessionKey ?? undefined,
        message: prepared.prompt,
        deliver: false,
        timeoutMs: AGENT_TIMEOUT_MS,
        idempotencyKey: runId,
      });
      await finalPromise;
      this.getAgent(agentName)
        .then((agent) => trackUsage(agentName, agent?.model ?? 'unknown', prepared.prompt, accumulated, Date.now() - startTime))
        .catch(() => {});
    } finally {
      client.stop();
    }
  }

  async listAgents(): Promise<OpenClawAgent[]> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; name?: string; agentDir?: string }> = config?.agents?.list ?? [];
      const agents: OpenClawAgent[] = [];

      for (const entry of list) {
        const agentDir = entry.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', entry.id, 'agent');
        try {
          const configPath = path.join(agentDir, 'config.json');
          const raw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
          const agentConfig = JSON.parse(raw);
          agents.push({
            id: entry.id,
            name: entry.name ?? entry.id,
            role: agentConfig.role ?? entry.id,
            model: agentConfig.model?.primary ?? DEFAULT_AGENT_MODEL,
            systemPrompt: agentConfig.systemPrompt,
            tools: agentConfig.tools ?? [],
            status: 'idle',
          });
        } catch {
          agents.push({ id: entry.id, name: entry.name ?? entry.id, role: entry.id, model: DEFAULT_AGENT_MODEL, tools: [], status: 'offline' });
        }
      }
      return agents;
    } catch (err) {
      logger.error({ err }, 'Failed to list OpenClaw agents');
      return [];
    }
  }

  async listCommands(agentId?: string): Promise<{ commands: Array<Record<string, unknown>> }> {
    return this.requestGateway('commands.list', {
      ...(agentId ? { agentId } : {}),
      includeArgs: true,
      scope: 'text',
    });
  }

  private async resolveOpenclawBin(): Promise<string> {
    const nvmDir = path.join(process.env.HOME ?? '', '.nvm', 'versions', 'node');
    try {
      const versions = await fs.readdir(nvmDir);
      const v22Plus = versions
        .filter((v) => /^v(2[2-9]|[3-9]\d|\d{3,})/.test(v))
        .sort()
        .reverse();
      for (const version of v22Plus) {
        const bin = path.join(nvmDir, version, 'bin', 'openclaw');
        try {
          await fs.access(bin);
          return bin;
        } catch { /* not installed under this version */ }
      }
    } catch { /* nvm not found */ }
    return 'openclaw';
  }

  async sendMessage(agentName: string, message: string, attachments: MessageAttachmentInput[] = [], sessionKey?: string | null): Promise<string> {
    const startTime = Date.now();
    const bin = await this.resolveOpenclawBin();
    const prepared = await prepareMessageWithAttachments(agentName, message, attachments);

    return new Promise<string>((resolve, reject) => {
      const child = spawn(bin, this.buildAgentArgs(agentName, prepared.prompt, sessionKey), {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Agent ${agentName} timed out after ${AGENT_TIMEOUT_LABEL}`));
      }, AGENT_TIMEOUT_MS);

      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('error', (err) => {
        clearTimeout(timeout);
        logger.error({ agent: agentName, err: err.message }, 'OpenClaw message failed');
        reject(new Error(`Agent ${agentName} failed: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const response = stdout.trim();
          this.getAgent(agentName)
            .then((agent) =>
              trackUsage(agentName, agent?.model ?? 'unknown', prepared.prompt, response, Date.now() - startTime)
            )
            .catch(() => {});
          resolve(response);
        } else {
          logger.error({ agent: agentName, code, stderr: stderr.slice(-500) }, 'OpenClaw message failed');
          reject(new Error(`Agent ${agentName} exited with code ${code ?? 'unknown'}`));
        }
      });
    });
  }

  async sendMessageStream(
    agentName: string,
    message: string,
    attachments: MessageAttachmentInput[] = [],
    sessionKey: string | null | undefined,
    onChunk: (chunk: string) => void,
    onDone: (full: string) => void,
    onError: (err: Error) => void,
    onToolUse?: (toolName: string, phase?: 'use' | 'result') => void,
  ): Promise<void> {
    if (process.env.OPENCLAW_LYFESTACK_GATEWAY_STREAM !== '0') {
      try {
        await this.sendMessageStreamGateway(agentName, message, attachments, sessionKey, onChunk, onDone, onError, onToolUse);
        return;
      } catch (gatewayErr) {
        logger.warn({ err: gatewayErr, agent: agentName }, 'OpenClaw gateway stream failed; falling back to CLI');
      }
    }
    const startTime = Date.now();
    const bin = await this.resolveOpenclawBin();
    const prepared = await prepareMessageWithAttachments(agentName, message, attachments);

    // Strip ANSI escape codes from CLI output
    const stripAnsi = (text: string): string =>
      text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\][^\x07]*\x07/g, '');

    const child = spawn(bin, this.buildAgentArgs(agentName, prepared.prompt, sessionKey), {
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
    });

    let full = '';
    let stderrBuffer = '';
    let done = false;
    let sawChunk = false;

    // Timeout: if CLI hangs too long, kill it. Long coding/tool runs can legitimately be slow.
    const timeout = setTimeout(() => {
      if (!done) {
        child.kill('SIGTERM');
        onError(new Error(`Agent ${agentName} timed out after ${AGENT_TIMEOUT_LABEL}`));
        done = true;
      }
    }, AGENT_TIMEOUT_MS);

    child.stdout.on('data', (data: Buffer) => {
      if (done) return;
      const raw = data.toString();
      const clean = stripAnsi(raw);
      if (!clean.trim()) return; // Skip empty/whitespace-only chunks
      full += clean;
      sawChunk = true;
      onChunk(clean);
    });

    child.stderr.on('data', (data: Buffer) => {
      if (done) return;
      const text = stripAnsi(data.toString());
      stderrBuffer += text;
      logger.debug({ agent: agentName }, `stderr: ${text.trim()}`);
      // Parse stderr for tool usage patterns.
      // Common patterns: "Tool call read", "Tool output read", "Using tool: bash".
      if (onToolUse) {
        for (const line of text.split(/\r?\n/)) {
          const toolOutput = line.match(/Tool output\s+([\w.-]+)/i);
          if (toolOutput?.[1]) {
            onToolUse(toolOutput[1], 'result');
            continue;
          }

          const toolCall = line.match(/Tool call\s+([\w.-]+)/i)
            ?? line.match(/Using tool:?\s+([\w.-]+)/i)
            ?? line.match(/tool[:\s]+([\w.-]+)/i);
          if (toolCall?.[1]) onToolUse(toolCall[1], 'use');
        }
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (done) return;
      done = true;
      if (full.length > 0) {
        const response = full.trim();
        if (!sawChunk) onChunk(response);
        this.getAgent(agentName)
          .then((agent) =>
            trackUsage(agentName, agent?.model ?? 'unknown', prepared.prompt, response, Date.now() - startTime)
          )
          .catch(() => {});
        onDone(response);
      } else {
        onError(new Error(`Agent ${agentName} exited with code ${code ?? 'unknown'}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (done) return;
      done = true;
      logger.error({ agent: agentName, err: err.message }, 'OpenClaw stream failed');
      onError(err);
    });
  }

  async createAgent(config: { name: string; role: string; model: string; systemPrompt: string }): Promise<void> {
    const agentDir = path.join(OPENCLAW_CONFIG, 'agents', config.name, 'agent');
    await fs.mkdir(agentDir, { recursive: true });
    const model = config.model || DEFAULT_AGENT_MODEL;

    const agentConfig = {
      role: config.role,
      model: { primary: model, fallbacks: [] },
      systemPrompt: config.systemPrompt,
      tools: [],
    };
    await fs.writeFile(path.join(agentDir, 'config.json'), JSON.stringify(agentConfig, null, 2));

    // Register in openclaw.json so the CLI recognizes the agent
    const openclawData = await readOpenclawJson();
    if (!openclawData.agents) openclawData.agents = { list: [] };
    const list: Array<{ id: string }> = openclawData.agents.list;
    if (!list.find((e) => e.id === config.name)) {
      list.push({ id: config.name, name: config.name, workspace: path.join(OPENCLAW_CONFIG, 'workspace'), agentDir } as any);
      await writeOpenclawJson(openclawData);
    }

    logger.info({ agent: config.name }, 'OpenClaw agent created');
  }

  async deleteAgent(name: string): Promise<void> {
    const agentDir = path.join(OPENCLAW_CONFIG, 'agents', name);
    await fs.rm(agentDir, { recursive: true, force: true });

    // Remove from openclaw.json
    try {
      const openclawData = await readOpenclawJson();
      if (openclawData.agents?.list) {
        openclawData.agents.list = openclawData.agents.list.filter((e: any) => e.id !== name);
        await writeOpenclawJson(openclawData);
      }
    } catch (err) {
      logger.warn({ err, agent: name }, 'Could not remove agent from openclaw.json');
    }

    logger.info({ agent: name }, 'OpenClaw agent deleted');
  }

  async getAgent(name: string): Promise<OpenClawAgent & { systemPrompt?: string; persona?: Record<string, unknown>; skills?: string[] } | null> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; name?: string; agentDir?: string }> = config?.agents?.list ?? [];
      const entry = list.find((e) => e.id === name);
      if (!entry) return null;
      const agentDir = entry.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
      const raw = await fs.readFile(path.join(agentDir, 'config.json'), 'utf-8').catch(() => '{}');
      const agentConfig = JSON.parse(raw);
      const skills = Array.isArray(agentConfig.skills)
        ? agentConfig.skills
        : (await this.listSkills()).map((s) => s.name);
      return {
        id: name,
        name: entry.name ?? name,
        role: agentConfig.role ?? name,
        model: agentConfig.model?.primary ?? DEFAULT_AGENT_MODEL,
        fallbackModels: agentConfig.model?.fallbacks ?? [],
        systemPrompt: agentConfig.systemPrompt ?? '',
        persona: agentConfig.persona ?? {},
        tools: agentConfig.tools ?? [],
        skills,
        status: 'idle',
      };
    } catch (err) {
      logger.error({ err, agent: name }, 'Failed to get agent');
      return null;
    }
  }

  async getAgentSkills(name: string): Promise<string[]> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
      const entry = list.find((e) => e.id === name);
      const agentDir = entry?.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
      const raw = await fs.readFile(path.join(agentDir, 'config.json'), 'utf-8').catch(() => '{}');
      const agentConfig = JSON.parse(raw);
      if (Array.isArray(agentConfig.skills)) return agentConfig.skills;
      // No explicit assignment — return all available skills
      const allSkills = await this.listSkills();
      return allSkills.map((s) => s.name);
    } catch (err) {
      logger.error({ err, agent: name }, 'Failed to get agent skills');
      return [];
    }
  }

  async setAgentSkills(name: string, skillNames: string[]): Promise<void> {
    const config = await readOpenclawJson();
    const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
    const entry = list.find((e) => e.id === name);
    const agentDir = entry?.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
    const configPath = path.join(agentDir, 'config.json');
    const raw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
    const existing = JSON.parse(raw);
    existing.skills = skillNames;
    await fs.writeFile(configPath, JSON.stringify(existing, null, 2));
    logger.info({ agent: name, skills: skillNames }, 'Agent skills updated');
  }

  async updateAgent(name: string, updates: { displayName?: string; role?: string; model?: string; systemPrompt?: string; persona?: Record<string, unknown> }): Promise<void> {
    const config = await readOpenclawJson();
    const list: Array<{ id: string; name?: string; agentDir?: string }> = config?.agents?.list ?? [];
    const entry = list.find((e) => e.id === name);
    const agentDir = entry?.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
    const configPath = path.join(agentDir, 'config.json');
    const raw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
    const existing = JSON.parse(raw);
    const merged = {
      ...existing,
      ...(updates.role !== undefined && { role: updates.role }),
      ...(updates.model !== undefined && { model: { primary: updates.model, fallbacks: existing.model?.fallbacks ?? [] } }),
      ...(updates.systemPrompt !== undefined && { systemPrompt: updates.systemPrompt }),
      ...(updates.persona !== undefined && { persona: updates.persona }),
    };
    await fs.writeFile(configPath, JSON.stringify(merged, null, 2));
    if (updates.displayName !== undefined && entry) {
      entry.name = updates.displayName.trim() || name;
      await writeOpenclawJson(config);
    }
    logger.info({ agent: name }, 'Agent updated');
  }

  async renameAgent(oldName: string, newName: string): Promise<void> {
    const slug = newName.trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(slug)) {
      throw new Error('Invalid agent name — use lowercase letters, digits, dash or underscore (max 48 chars)');
    }
    if (slug === oldName) return;

    const oldAgentRoot = path.join(OPENCLAW_CONFIG, 'agents', oldName);
    const newAgentRoot = path.join(OPENCLAW_CONFIG, 'agents', slug);

    try {
      await fs.access(oldAgentRoot);
    } catch {
      throw new Error('Agent not found');
    }
    try {
      await fs.access(newAgentRoot);
      throw new Error('An agent with that name already exists');
    } catch (err: any) {
      if (err?.message === 'An agent with that name already exists') throw err;
    }

    await fs.rename(oldAgentRoot, newAgentRoot);

    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; name?: string; agentDir?: string }> = config?.agents?.list ?? [];
      const entry = list.find((e) => e.id === oldName);
      if (entry) {
        entry.id = slug;
        if (entry.name === oldName) entry.name = slug;
        if (entry.agentDir) {
          entry.agentDir = entry.agentDir.replace(
            path.join(OPENCLAW_CONFIG, 'agents', oldName),
            path.join(OPENCLAW_CONFIG, 'agents', slug),
          );
        }
        await writeOpenclawJson(config);
      }
    } catch (err) {
      logger.error({ err, oldName, newName: slug }, 'Failed to update openclaw.json after rename');
    }

    try {
      const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
      const oldPrefixes = [
        oldName.toLowerCase() + '_',
        oldName.toLowerCase() + '-',
        oldName.toLowerCase().replace(/-/g, '_') + '_',
      ];
      for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.md')) continue;
        const lower = ent.name.toLowerCase();
        const matched = oldPrefixes.find((p) => lower.startsWith(p));
        if (!matched) continue;
        const rest = ent.name.slice(matched.length);
        const newFilename = `${slug}_${rest}`;
        await fs.rename(path.join(WORKSPACE, ent.name), path.join(WORKSPACE, newFilename)).catch((err) => {
          logger.warn({ err, file: ent.name }, 'Could not rename workspace file');
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Skipped workspace file rename — directory not readable');
    }

    logger.info({ oldName, newName: slug }, 'Agent renamed');
  }

  async listAgentFiles(name: string): Promise<AgentFile[]> {
    const results: AgentFile[] = [];

    // Agent-specific files: workspace files prefixed with the agent name
    try {
      const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
      const agentPrefix = name.toLowerCase().replace(/-/g, '_');
      const agentPrefixDash = name.toLowerCase();

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const lower = entry.name.toLowerCase();
        if (!lower.startsWith(agentPrefix + '_') && !lower.startsWith(agentPrefixDash + '-') && !lower.startsWith(agentPrefixDash + '_')) continue;
        const filePath = path.join(WORKSPACE, entry.name);
        const [content, stat] = await Promise.all([
          fs.readFile(filePath, 'utf-8').catch(() => ''),
          fs.stat(filePath).catch(() => null),
        ]);
        results.push({
          filename: entry.name,
          type: 'identity',
          preview: content.slice(0, 120).replace(/\n+/g, ' ').trim(),
          size: stat?.size ?? 0,
          modifiedAt: stat?.mtime.toISOString() ?? '',
        });
      }
    } catch { /* workspace may not exist */ }

    // Shared identity files
    for (const filename of SHARED_FILES) {
      const filePath = path.join(WORKSPACE, filename);
      try {
        const [content, stat] = await Promise.all([
          fs.readFile(filePath, 'utf-8'),
          fs.stat(filePath),
        ]);
        results.push({
          filename,
          type: 'shared',
          preview: content.slice(0, 120).replace(/\n+/g, ' ').trim(),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch { /* file doesn't exist yet */ }
    }

    return results;
  }

  async getAgentFile(name: string, filename: string): Promise<string> {
    const safe = path.basename(filename);
    if (!safe.endsWith('.md')) throw new Error('Only .md files are accessible');
    // Allow agent-specific files and shared files
    const agentPrefix = name.toLowerCase().replace(/-/g, '_');
    const agentPrefixDash = name.toLowerCase();
    const isShared = SHARED_FILES.includes(safe);
    const isAgentFile = safe.toLowerCase().startsWith(agentPrefix + '_') || safe.toLowerCase().startsWith(agentPrefixDash + '_') || safe.toLowerCase().startsWith(agentPrefixDash + '-');
    if (!isShared && !isAgentFile) throw new Error('File not accessible for this agent');
    return fs.readFile(path.join(WORKSPACE, safe), 'utf-8');
  }

  async updateAgentFile(name: string, filename: string, content: string): Promise<void> {
    const safe = path.basename(filename);
    if (!safe.endsWith('.md')) throw new Error('Only .md files are writable');
    const agentPrefix = name.toLowerCase().replace(/-/g, '_');
    const agentPrefixDash = name.toLowerCase();
    const isShared = SHARED_FILES.includes(safe);
    const isAgentFile = safe.toLowerCase().startsWith(agentPrefix + '_') || safe.toLowerCase().startsWith(agentPrefixDash + '_') || safe.toLowerCase().startsWith(agentPrefixDash + '-');
    if (!isShared && !isAgentFile) throw new Error('File not writable for this agent');
    await fs.mkdir(WORKSPACE, { recursive: true });
    await fs.writeFile(path.join(WORKSPACE, safe), content, 'utf-8');
    logger.info({ agent: name, file: safe }, 'Agent file updated');
  }

  async getStatus(): Promise<{ running: boolean; agentCount: number }> {
    try {
      const agents = await this.listAgents();
      return { running: true, agentCount: agents.length };
    } catch {
      return { running: false, agentCount: 0 };
    }
  }

  async getConfig(): Promise<OpenClawConfig> {
    const cfg = await readOpenclawJson();

    const modelSet = new Set<string>();
    const modelDetails = new Map<string, { id: string; reasoning: boolean; contextWindow: number; maxTokens: number }>();
    const providers: Record<string, any> = cfg?.models?.providers ?? {};
    for (const [providerName, providerCfg] of Object.entries(providers)) {
      const models: Array<{ id?: string }> = (providerCfg as any)?.models ?? [];
      for (const model of models) {
        if (model?.id) {
          const id = `${providerName}/${model.id}`;
          modelSet.add(id);
          modelDetails.set(id, {
            id,
            reasoning: Boolean((model as any)?.reasoning),
            contextWindow: Number((model as any)?.contextWindow ?? 0),
            maxTokens: Number((model as any)?.maxTokens ?? 0),
          });
        }
      }
    }
    const agentModels: Record<string, unknown> = cfg?.agents?.defaults?.models ?? {};
    for (const key of Object.keys(agentModels)) {
      modelSet.add(key);
      if (!modelDetails.has(key)) {
        const meta = agentModels[key] as Record<string, unknown> | undefined;
        modelDetails.set(key, {
          id: key,
          reasoning: Boolean(meta?.reasoning),
          contextWindow: Number(meta?.contextWindow ?? 0),
          maxTokens: Number(meta?.maxTokens ?? 0),
        });
      }
    }

    return {
      gateway: {
        port: cfg?.gateway?.port ?? 18789,
        mode: cfg?.gateway?.mode ?? 'local',
        bind: cfg?.gateway?.bind ?? 'loopback',
      },
      agentDefaults: {
        primaryModel: cfg?.agents?.defaults?.model?.primary ?? DEFAULT_AGENT_MODEL,
        fallbackModels: cfg?.agents?.defaults?.model?.fallbacks ?? [],
      },
      codingTool: cfg?.commands?.native ?? 'auto',
      availableModels: Array.from(modelSet),
      availableModelDetails: Array.from(modelDetails.values()),
    };
  }

  async updateConfig(updates: DeepPartial<OpenClawConfig>): Promise<void> {
    const cfg = await readOpenclawJson();
    if (updates.agentDefaults?.primaryModel !== undefined) {
      cfg.agents ??= {};
      cfg.agents.defaults ??= {};
      cfg.agents.defaults.model ??= {};
      cfg.agents.defaults.model.primary = updates.agentDefaults.primaryModel;
    }
    if (updates.agentDefaults?.fallbackModels !== undefined) {
      cfg.agents ??= {};
      cfg.agents.defaults ??= {};
      cfg.agents.defaults.model ??= {};
      cfg.agents.defaults.model.fallbacks = updates.agentDefaults.fallbackModels;
    }
    if (updates.codingTool !== undefined) {
      cfg.commands ??= {};
      cfg.commands.native = updates.codingTool;
    }
    await writeOpenclawJson(cfg);
    logger.info({ updates }, 'OpenClaw config updated');
  }

  async getAuthProfiles(): Promise<AuthProfileInfo[]> {
    const cfg = await readOpenclawJson();
    const profiles: Record<string, any> = cfg?.auth?.profiles ?? {};
    const env: Record<string, string> = cfg?.env ?? {};

    return Object.entries(profiles).map(([name, profile]) => {
      const providerUpper = (profile.provider as string | undefined)?.toUpperCase();
      const envVar = providerUpper ? `${providerUpper}_API_KEY` : undefined;
      const rawKey = envVar ? env[envVar] : undefined;
      return {
        name,
        provider: profile.provider ?? '',
        mode: profile.mode ?? '',
        ...(rawKey ? { maskedKey: maskKey(rawKey) } : {}),
        ...(envVar !== undefined ? { envVar } : {}),
      } satisfies AuthProfileInfo;
    });
  }

  async updateAuthProfile(name: string, key: string): Promise<void> {
    const cfg = await readOpenclawJson();
    // Auto-create profile if it doesn't exist
    cfg.auth ??= {};
    cfg.auth.profiles ??= {};
    if (!cfg.auth.profiles[name]) {
      const provider = name.split(':')[0] ?? name;
      cfg.auth.profiles[name] = { provider, mode: 'api_key' };
      logger.info({ profile: name, provider }, 'Created new auth profile');
    }
    const profile = cfg.auth.profiles[name];
    const providerUpper = (profile.provider as string | undefined)?.toUpperCase();
    if (!providerUpper) throw new Error('Cannot determine env var for profile');
    const envVar = `${providerUpper}_API_KEY`;
    cfg.env ??= {};
    cfg.env[envVar] = key;
    await writeOpenclawJson(cfg);
    logger.info({ profile: name, envVar }, 'Auth profile key updated');
  }

  async listSkills(): Promise<SkillInfo[]> {
    try {
      await fs.mkdir(SKILLS_DIR, { recursive: true });
      const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
      const skills: SkillInfo[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
        try {
          const [content, stat] = await Promise.all([
            fs.readFile(skillPath, 'utf-8'),
            fs.stat(skillPath),
          ]);
          const descMatch = content.match(/^description:\s*["']?(.*?)["']?\s*$/m);
          const description = descMatch?.[1] ? descMatch[1].replace(/^["']|["']$/g, '') : '';
          skills.push({ name: entry.name, description, size: stat.size, modifiedAt: stat.mtime.toISOString() });
        } catch {
          skills.push({ name: entry.name, description: '', size: 0, modifiedAt: '' });
        }
      }
      return skills;
    } catch (err) {
      logger.error({ err }, 'Failed to list skills');
      return [];
    }
  }

  async getSkill(name: string): Promise<{ name: string; content: string } | null> {
    const safe = path.basename(name);
    try {
      const content = await fs.readFile(path.join(SKILLS_DIR, safe, 'SKILL.md'), 'utf-8');
      return { name: safe, content };
    } catch {
      return null;
    }
  }

  async createSkill(name: string, content: string): Promise<void> {
    const safe = path.basename(name).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!safe) throw new Error('Invalid skill name');
    const skillDir = path.join(SKILLS_DIR, safe);
    const existing = await fs.stat(path.join(skillDir, 'SKILL.md')).catch(() => null);
    if (existing) throw new Error(`Skill '${safe}' already exists`);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    logger.info({ skill: safe }, 'Skill created');
  }

  async updateSkill(name: string, content: string): Promise<void> {
    const safe = path.basename(name);
    await fs.writeFile(path.join(SKILLS_DIR, safe, 'SKILL.md'), content, 'utf-8');
    logger.info({ skill: safe }, 'Skill updated');
  }

  async deleteSkill(name: string): Promise<void> {
    const safe = path.basename(name);
    await fs.rm(path.join(SKILLS_DIR, safe), { recursive: true, force: true });
    logger.info({ skill: safe }, 'Skill deleted');
  }
}
