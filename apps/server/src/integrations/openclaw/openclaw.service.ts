import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

const execFileAsync = promisify(execFile);

interface ContentPart {
  type: string;
  text?: string;
}

interface SessionMessage {
  role: 'user' | 'assistant';
  content: ContentPart[] | string | null;
  timestamp?: number;
  stopReason?: string;
  errorMessage?: string;
}

export interface OpenClawAgent {
  id: string;
  name?: string;
  model: { primary: string; fallbacks: string[] };
  workspace: string;
}

export interface OpenClawSession {
  key: string;
  sessionId: string;
  displayName?: string;
  status: string;
  updatedAt: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  model?: string;
  lastChannel?: string;
}

function extractText(content: ContentPart[] | string | null): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('');
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class OpenClawService {
  private async callGateway<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30000,
  ): Promise<T> {
    const args = [
      'gateway', 'call', '--json',
      '--timeout', String(timeoutMs),
      method,
      '--params', JSON.stringify(params),
    ];
    if (config.OPENCLAW_GATEWAY_URL) args.push('--url', config.OPENCLAW_GATEWAY_URL);
    if (config.OPENCLAW_GATEWAY_TOKEN) args.push('--token', config.OPENCLAW_GATEWAY_TOKEN);

    try {
      const { stdout } = await execFileAsync('openclaw', args, { timeout: timeoutMs + 5000 });
      return JSON.parse(stdout.trim()) as T;
    } catch (err: any) {
      logger.error({ method, params, err: err.message }, 'Gateway call failed');
      throw new Error(`Gateway ${method} failed: ${err.message}`);
    }
  }

  async listAgents(): Promise<OpenClawAgent[]> {
    const result = await this.callGateway<{ agents: OpenClawAgent[] }>('agents.list');
    return result.agents ?? [];
  }

  async sendMessage(agentId: string, message: string): Promise<string> {
    const sendTime = Date.now();

    const created = await this.callGateway<{ key: string; sessionId: string; ok: boolean }>(
      'sessions.create',
      { agentId, label: `lyfestack-${sendTime}` },
    );
    const sessionKey = created.key;

    await this.callGateway('sessions.send', { key: sessionKey, body: message });

    // Poll sessions.get until an assistant reply appears after sendTime
    const deadline = sendTime + 120_000;
    while (Date.now() < deadline) {
      await delay(2000);
      const data = await this.callGateway<{ messages?: SessionMessage[] }>(
        'sessions.get',
        { key: sessionKey },
      );
      const messages = data.messages ?? [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]!;
        if (msg.role === 'assistant' && (msg.timestamp ?? 0) >= sendTime) {
          const text = extractText(msg.content as ContentPart[]);
          return text || '(no response)';
        }
      }
    }

    return '(timeout: no response received)';
  }

  async createAgent(agentConfig: { name: string; model?: string }): Promise<void> {
    await this.callGateway('agents.create', { id: agentConfig.name });
    logger.info({ agent: agentConfig.name }, 'OpenClaw agent created via gateway');
  }

  async deleteAgent(name: string): Promise<void> {
    await this.callGateway('agents.delete', { id: name });
    logger.info({ agent: name }, 'OpenClaw agent deleted via gateway');
  }

  async getStatus(): Promise<{ running: boolean; agentCount: number; version: string }> {
    const [statusResult, agents] = await Promise.all([
      this.callGateway<{ runtimeVersion?: string }>('status'),
      this.listAgents(),
    ]);
    return {
      running: true,
      agentCount: agents.length,
      version: statusResult.runtimeVersion ?? 'unknown',
    };
  }

  async listSessions(limit = 20): Promise<OpenClawSession[]> {
    const result = await this.callGateway<{ sessions: OpenClawSession[] }>(
      'sessions.list',
      { limit },
    );
    return result.sessions ?? [];
  }

  async getSession(key: string): Promise<{ messages: SessionMessage[] } & Record<string, unknown>> {
    return this.callGateway('sessions.get', { key });
  }

  async createSession(
    agentId: string,
    label?: string,
  ): Promise<{ key: string; sessionId: string; ok: boolean }> {
    return this.callGateway('sessions.create', {
      agentId,
      label: label ?? `lyfestack-${Date.now()}`,
    });
  }
}
