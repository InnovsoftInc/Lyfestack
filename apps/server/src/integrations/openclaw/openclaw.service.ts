import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { OpenClawAgent, OpenClawMessage } from '@lyfestack/shared';
import { NotFoundError, ExternalServiceError } from '../../errors/AppError';

const execAsync = promisify(exec);

const CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const AGENTS_DIR = path.join(os.homedir(), '.openclaw', 'agents');
const GATEWAY_URL = 'http://127.0.0.1:18789';

interface OpenClawConfig {
  gateway?: { port?: number; auth?: { token?: string } };
  agents?: {
    defaults?: { model?: { primary?: string } };
    list?: Array<{ id: string; name?: string; agentDir?: string }>;
  };
}

async function readConfig(): Promise<OpenClawConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    return {};
  }
}

async function getGatewayToken(): Promise<string> {
  const config = await readConfig();
  return config.gateway?.auth?.token ?? '';
}

async function readAgentDir(agentDir: string): Promise<Partial<OpenClawAgent>> {
  try {
    const modelsPath = path.join(agentDir, 'models.json');
    const raw = await fs.readFile(modelsPath, 'utf-8');
    const models = JSON.parse(raw) as { providers?: Record<string, { models?: Array<{ id: string }> }> };
    const firstProvider = Object.values(models.providers ?? {})[0];
    const model = firstProvider?.models?.[0]?.id ?? '';
    return { model };
  } catch {
    return {};
  }
}

async function getLatestSessionFile(agentId: string): Promise<string | null> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
  try {
    const files = await fs.readdir(sessionsDir);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
    if (!jsonlFiles.length) return null;
    const withStats = await Promise.all(
      jsonlFiles.map(async (f) => {
        const stat = await fs.stat(path.join(sessionsDir, f));
        return { name: f, mtime: stat.mtimeMs };
      }),
    );
    withStats.sort((a, b) => b.mtime - a.mtime);
    return path.join(sessionsDir, withStats[0]!.name);
  } catch {
    return null;
  }
}

async function parseSessionMessages(filePath: string, agentId: string): Promise<OpenClawMessage[]> {
  const messages: OpenClawMessage[] = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let idx = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as {
        type: string;
        id?: string;
        timestamp?: string;
        message?: { role?: string; content?: Array<{ type: string; text?: string }> | string };
      };
      if (entry.type === 'message' && entry.message) {
        const role = entry.message.role === 'assistant' ? 'assistant' : 'user';
        let content = '';
        if (typeof entry.message.content === 'string') {
          content = entry.message.content;
        } else if (Array.isArray(entry.message.content)) {
          content = entry.message.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('');
        }
        if (content) {
          messages.push({
            id: entry.id ?? String(idx++),
            agentId,
            role,
            content,
            timestamp: entry.timestamp ?? new Date().toISOString(),
          });
        }
      }
    } catch {
      // skip malformed lines
    }
  }
  return messages;
}

export class OpenClawService {
  async getGatewayStatus(): Promise<{ connected: boolean; port: number }> {
    const token = await getGatewayToken();
    const port = 18789;
    try {
      const res = await fetch(`${GATEWAY_URL}/healthz`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(2000),
      });
      return { connected: res.ok || res.status < 500, port };
    } catch {
      return { connected: false, port };
    }
  }

  async listAgents(): Promise<OpenClawAgent[]> {
    const config = await readConfig();
    const defaultModel = config.agents?.defaults?.model?.primary ?? 'openrouter/auto';
    const list = config.agents?.list ?? [];

    const agents: OpenClawAgent[] = await Promise.all(
      list.map(async (entry) => {
        const extra = entry.agentDir ? await readAgentDir(entry.agentDir) : {};
        const lastActive = await this.getLastActive(entry.id);
        return {
          id: entry.id,
          name: entry.name ?? entry.id,
          role: entry.id,
          model: extra.model ?? defaultModel,
          tools: [],
          status: 'idle' as const,
          lastActive: lastActive ?? undefined,
          agentDir: entry.agentDir,
        };
      }),
    );

    return agents;
  }

  private async getLastActive(agentId: string): Promise<string | null> {
    const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions');
    try {
      const files = await fs.readdir(sessionsDir);
      if (!files.length) return null;
      const stats = await Promise.all(
        files.map(async (f) => (await fs.stat(path.join(sessionsDir, f))).mtimeMs),
      );
      const latest = Math.max(...stats);
      return new Date(latest).toISOString();
    } catch {
      return null;
    }
  }

  async getAgent(id: string): Promise<OpenClawAgent> {
    const agents = await this.listAgents();
    const agent = agents.find((a) => a.id === id);
    if (!agent) throw new NotFoundError(`Agent '${id}'`);
    return agent;
  }

  async createAgent(params: { id: string; name?: string; role?: string; systemPrompt?: string }): Promise<void> {
    const config = await readConfig();
    if (!config.agents) config.agents = { list: [] };
    if (!config.agents.list) config.agents.list = [];

    const exists = config.agents.list.find((a) => a.id === params.id);
    if (exists) throw new Error(`Agent '${params.id}' already exists`);

    const agentDir = path.join(AGENTS_DIR, params.id, 'agent');
    await fs.mkdir(agentDir, { recursive: true });

    config.agents.list.push({ id: params.id, name: params.name ?? params.id, agentDir });

    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  }

  async deleteAgent(id: string): Promise<void> {
    const config = await readConfig();
    const list = config.agents?.list ?? [];
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) throw new NotFoundError(`Agent '${id}'`);
    list.splice(idx, 1);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  }

  async sendMessage(
    agentId: string,
    message: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('openclaw', ['agent', '--agent', agentId, '-m', message], {
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ''}` },
      });

      let output = '';
      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        onChunk?.(text);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (!text.includes('[INFO]') && !text.includes('[DEBUG]')) {
          output += text;
        }
      });
      child.on('close', (code) => {
        if (code !== 0 && !output) {
          reject(new ExternalServiceError('OpenClaw', `Agent process exited with code ${code}`));
        } else {
          resolve(output.trim());
        }
      });
      child.on('error', (err) => {
        reject(new ExternalServiceError('OpenClaw', err.message));
      });
    });
  }

  async getAgentHistory(agentId: string, limit = 50): Promise<OpenClawMessage[]> {
    const filePath = await getLatestSessionFile(agentId);
    if (!filePath) return [];
    const messages = await parseSessionMessages(filePath, agentId);
    return messages.slice(-limit);
  }

  async getAgentStatus(agentId: string): Promise<{ status: 'active' | 'idle' | 'offline' }> {
    const { connected } = await this.getGatewayStatus();
    if (!connected) return { status: 'offline' };
    try {
      const { stdout } = await execAsync(
        `pgrep -f "openclaw.*agent.*${agentId}" | head -1`,
      );
      return { status: stdout.trim() ? 'active' : 'idle' };
    } catch {
      return { status: 'idle' };
    }
  }
}

export const openClawService = new OpenClawService();
