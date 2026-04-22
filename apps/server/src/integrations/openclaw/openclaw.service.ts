import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);
const OPENCLAW_CONFIG = path.join(process.env.HOME ?? '', '.openclaw');
const OPENCLAW_JSON = path.join(OPENCLAW_CONFIG, 'openclaw.json');
const WORKSPACE = path.join(OPENCLAW_CONFIG, 'workspace');

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
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface AuthProfileInfo {
  name: string;
  provider: string;
  mode: string;
  maskedKey?: string;
  envVar?: string;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

export interface OpenClawAgent {
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
}

async function readOpenclawJson(): Promise<any> {
  const raw = await fs.readFile(OPENCLAW_JSON, 'utf-8');
  return JSON.parse(raw);
}

async function writeOpenclawJson(data: any): Promise<void> {
  await fs.writeFile(OPENCLAW_JSON, JSON.stringify(data, null, 2));
}

export class OpenClawService {
  async listAgents(): Promise<OpenClawAgent[]> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
      const agents: OpenClawAgent[] = [];

      for (const entry of list) {
        const agentDir = entry.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', entry.id, 'agent');
        try {
          const configPath = path.join(agentDir, 'config.json');
          const raw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
          const agentConfig = JSON.parse(raw);
          agents.push({
            name: entry.id,
            role: agentConfig.role ?? entry.id,
            model: agentConfig.model?.primary ?? 'openrouter/auto',
            systemPrompt: agentConfig.systemPrompt,
            tools: agentConfig.tools ?? [],
            status: 'idle',
          });
        } catch {
          agents.push({ name: entry.id, role: entry.id, model: 'unknown', tools: [], status: 'offline' });
        }
      }
      return agents;
    } catch (err) {
      logger.error({ err }, 'Failed to list OpenClaw agents');
      return [];
    }
  }

  async sendMessage(agentName: string, message: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `openclaw agent --agent ${agentName} -m "${message.replace(/"/g, '\\"')}"`,
        { timeout: 120000 }
      );
      return stdout.trim();
    } catch (err: any) {
      logger.error({ agent: agentName, err: err.message }, 'OpenClaw message failed');
      throw new Error(`Agent ${agentName} failed: ${err.message}`);
    }
  }

  async createAgent(config: { name: string; role: string; model: string; systemPrompt: string }): Promise<void> {
    const agentDir = path.join(OPENCLAW_CONFIG, 'agents', config.name, 'agent');
    await fs.mkdir(agentDir, { recursive: true });

    const agentConfig = {
      role: config.role,
      model: { primary: config.model, fallbacks: [] },
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

  async getAgent(name: string): Promise<OpenClawAgent & { systemPrompt?: string; persona?: Record<string, unknown> } | null> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
      const entry = list.find((e) => e.id === name);
      if (!entry) return null;
      const agentDir = entry.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
      const raw = await fs.readFile(path.join(agentDir, 'config.json'), 'utf-8').catch(() => '{}');
      const agentConfig = JSON.parse(raw);
      return {
        name,
        role: agentConfig.role ?? name,
        model: agentConfig.model?.primary ?? 'openrouter/auto',
        systemPrompt: agentConfig.systemPrompt ?? '',
        persona: agentConfig.persona ?? {},
        tools: agentConfig.tools ?? [],
        status: 'idle',
      };
    } catch (err) {
      logger.error({ err, agent: name }, 'Failed to get agent');
      return null;
    }
  }

  async updateAgent(name: string, updates: { role?: string; model?: string; systemPrompt?: string; persona?: Record<string, unknown> }): Promise<void> {
    const config = await readOpenclawJson();
    const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
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
    logger.info({ agent: name }, 'Agent updated');
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
    return {
      gateway: {
        port: cfg?.gateway?.port ?? 18789,
        mode: cfg?.gateway?.mode ?? 'local',
        bind: cfg?.gateway?.bind ?? 'loopback',
      },
      agentDefaults: {
        primaryModel: cfg?.agents?.defaults?.model?.primary ?? 'openrouter/auto',
        fallbackModels: cfg?.agents?.defaults?.model?.fallbacks ?? [],
      },
      codingTool: cfg?.commands?.native ?? 'auto',
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
        maskedKey: rawKey ? maskKey(rawKey) : undefined,
        envVar,
      } satisfies AuthProfileInfo;
    });
  }

  async updateAuthProfile(name: string, key: string): Promise<void> {
    const cfg = await readOpenclawJson();
    const profile = cfg?.auth?.profiles?.[name];
    if (!profile) throw new Error(`Auth profile '${name}' not found`);
    const providerUpper = (profile.provider as string | undefined)?.toUpperCase();
    if (!providerUpper) throw new Error('Cannot determine env var for profile');
    const envVar = `${providerUpper}_API_KEY`;
    cfg.env ??= {};
    cfg.env[envVar] = key;
    await writeOpenclawJson(cfg);
    logger.info({ profile: name, envVar }, 'Auth profile key updated');
  }
}
