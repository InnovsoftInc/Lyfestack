import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { usageTracker } from './usage-tracker';
import { OPENCLAW_HOME, OPENCLAW_JSON, readOpenclawJson as sharedRead, writeOpenclawJson as sharedWrite } from './openclaw-json';
const OPENCLAW_CONFIG = OPENCLAW_HOME;
const WORKSPACE = path.join(OPENCLAW_CONFIG, 'workspace');
const SKILLS_DIR = path.join(OPENCLAW_CONFIG, 'skills');

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
  name: string;
  role: string;
  model: string;
  fallbackModels?: string[];
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
}

async function readOpenclawJson(): Promise<any> {
  return sharedRead<any>();
}

async function writeOpenclawJson(data: any): Promise<void> {
  await sharedWrite(data);
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

  async sendMessage(agentName: string, message: string): Promise<string> {
    const startTime = Date.now();
    const bin = await this.resolveOpenclawBin();

    return new Promise<string>((resolve, reject) => {
      const child = spawn(bin, ['agent', '--agent', agentName, '-m', message], {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Agent ${agentName} timed out after 10 minutes`));
      }, 600_000);

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
              usageTracker.track({
                agentName,
                model: agent?.model ?? 'unknown',
                message,
                response,
                duration: Date.now() - startTime,
              })
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
    onChunk: (chunk: string) => void,
    onDone: (full: string) => void,
    onError: (err: Error) => void,
    onToolUse?: (toolName: string) => void,
  ): Promise<void> {
    const startTime = Date.now();
    const bin = await this.resolveOpenclawBin();

    const child = spawn(bin, ['agent', '--agent', agentName, '-m', message, '--output-format', 'stream-json'], {
      env: { ...process.env },
    });

    let full = '';
    let stderrBuffer = '';

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      // Try to parse stream-json events (one JSON per line)
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            onToolUse?.(event.content_block.name ?? 'tool');
          } else if (event.type === 'tool_use') {
            onToolUse?.(event.name ?? 'tool');
          } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const chunk = event.delta.text ?? '';
            full += chunk;
            onChunk(chunk);
          } else if (event.type === 'text') {
            full += (event.text ?? '');
            onChunk(event.text ?? '');
          }
        } catch {
          // Not JSON — treat as raw text chunk
          full += text;
          onChunk(text);
          break; // Only process the raw text once, not per-line
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrBuffer += text;
      logger.debug({ agent: agentName }, `stderr: ${text.trim()}`);
      // Parse stderr for tool usage patterns
      // Common patterns: "⚡ Tool call read", "Tool: Read", "Using tool: bash"
      const toolMatch = text.match(/(?:tool[:\s]+|⚡\s*(?:Tool call|Tool output)\s+)(\w+)/i);
      if (toolMatch?.[1] && onToolUse) {
        onToolUse(toolMatch[1]);
      }
    });

    child.on('close', (code) => {
      if (full.length > 0) {
        const response = full.trim();
        this.getAgent(agentName)
          .then((agent) =>
            usageTracker.track({
              agentName,
              model: agent?.model ?? 'unknown',
              message,
              response,
              duration: Date.now() - startTime,
            })
          )
          .catch(() => {});
        onDone(response);
      } else {
        onError(new Error(`Agent ${agentName} exited with code ${code ?? 'unknown'}`));
      }
    });

    child.on('error', (err) => {
      logger.error({ agent: agentName, err: err.message }, 'OpenClaw stream failed');
      onError(err);
    });
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

  async getAgent(name: string): Promise<OpenClawAgent & { systemPrompt?: string; persona?: Record<string, unknown>; skills?: string[] } | null> {
    try {
      const config = await readOpenclawJson();
      const list: Array<{ id: string; agentDir?: string }> = config?.agents?.list ?? [];
      const entry = list.find((e) => e.id === name);
      if (!entry) return null;
      const agentDir = entry.agentDir ?? path.join(OPENCLAW_CONFIG, 'agents', name, 'agent');
      const raw = await fs.readFile(path.join(agentDir, 'config.json'), 'utf-8').catch(() => '{}');
      const agentConfig = JSON.parse(raw);
      const skills = Array.isArray(agentConfig.skills)
        ? agentConfig.skills
        : (await this.listSkills()).map((s) => s.name);
      return {
        name,
        role: agentConfig.role ?? name,
        model: agentConfig.model?.primary ?? 'openrouter/auto',
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
    const providers: Record<string, any> = cfg?.models?.providers ?? {};
    for (const [providerName, providerCfg] of Object.entries(providers)) {
      const models: Array<{ id?: string }> = (providerCfg as any)?.models ?? [];
      for (const model of models) {
        if (model?.id) modelSet.add(`${providerName}/${model.id}`);
      }
    }
    const agentModels: Record<string, unknown> = cfg?.agents?.defaults?.models ?? {};
    for (const key of Object.keys(agentModels)) {
      modelSet.add(key);
    }

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
      availableModels: Array.from(modelSet),
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
          const description = descMatch ? descMatch[1].replace(/^["']|["']$/g, '') : '';
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
