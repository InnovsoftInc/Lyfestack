import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const OPENCLAW_DIR = path.join(process.env.HOME ?? '', '.openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
const WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace');

export interface Routine {
  id: string;
  name: string;
  description: string;
  type: 'heartbeat' | 'hook' | 'cron' | 'custom';
  schedule: string;
  trigger?: string;
  agentName?: string;
  model?: string;
  channel?: string;
  enabled: boolean;
  source: 'openclaw' | 'lyfestack';
  lastRun?: string;
  config?: Record<string, unknown>;
}

export type Automation = Routine;

interface HookMapping {
  match: { path: string };
  action?: string;
  wakeMode?: string;
  name?: string;
  sessionKey?: string;
  messageTemplate?: string;
  deliver?: boolean;
  channel?: string;
  to?: string;
  model?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      heartbeat?: {
        every: string;
        activeHours?: { start: string; end: string; timezone: string };
        model?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
  hooks?: {
    mappings?: HookMapping[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function readConfig(): Promise<OpenClawConfig> {
  try {
    return JSON.parse(await fs.readFile(OPENCLAW_CONFIG, 'utf-8')) as OpenClawConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: OpenClawConfig): Promise<void> {
  await fs.writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

function formatInterval(every: string): string {
  const m = every.match(/^(\d+)([smhd])$/);
  if (!m) return every;
  const labels: Record<string, string> = { s: 'sec', m: 'min', h: 'hr', d: 'day' };
  const n = Number(m[1]);
  const unit = labels[m[2]!] ?? m[2]!;
  return `Every ${n} ${unit}${n !== 1 ? 's' : ''}`;
}

async function scanCronFiles(): Promise<Routine[]> {
  const routines: Routine[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        await walk(full);
      } else if (entry.endsWith('.cron')) {
        let content: string;
        try {
          content = await fs.readFile(full, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!.trim();
          const parts = line.split(/\s+/);
          if (parts.length < 6) continue;
          const cronExpr = parts.slice(0, 5).join(' ');
          const command = parts.slice(5).join(' ');
          const relPath = path.relative(WORKSPACE_DIR, full);
          const baseName = path.basename(full, '.cron')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          routines.push({
            id: `cron:${relPath}:${i}`,
            name: baseName,
            description: command,
            type: 'cron',
            schedule: cronExpr,
            trigger: 'cron',
            enabled: true,
            source: 'openclaw',
            config: { file: full, command, cronExpr },
          });
        }
      }
    }
  }

  await walk(WORKSPACE_DIR);
  return routines;
}

export class AutomationsService {
  async list(): Promise<Routine[]> {
    const config = await readConfig();
    const routines: Routine[] = [];

    // 1. Heartbeat
    const hb = config.agents?.defaults?.heartbeat;
    if (hb) {
      const activeStr = hb.activeHours
        ? ` · ${hb.activeHours.start}–${hb.activeHours.end} ${hb.activeHours.timezone}`
        : '';
      routines.push({
        id: 'openclaw:heartbeat',
        name: 'Agent Heartbeat',
        description: `${formatInterval(hb.every)}${activeStr}`,
        type: 'heartbeat',
        schedule: formatInterval(hb.every),
        trigger: 'interval',
        model: hb.model as string | undefined,
        enabled: true,
        source: 'openclaw',
        config: hb as Record<string, unknown>,
      });
    }

    // 2. Hooks
    for (const hook of config.hooks?.mappings ?? []) {
      const hookPath = hook.match?.path ?? 'unknown';
      routines.push({
        id: `hook:${hookPath}`,
        name: hook.name ?? `/${hookPath} Hook`,
        description: hook.messageTemplate?.slice(0, 120) ?? `Webhook trigger: /${hookPath}`,
        type: 'hook',
        schedule: `Webhook /${hookPath}`,
        trigger: 'webhook',
        model: hook.model,
        channel: hook.channel,
        enabled: hook.enabled !== false,
        source: 'openclaw',
        config: hook as Record<string, unknown>,
      });
    }

    // 3. Cron files
    routines.push(...(await scanCronFiles()));

    return routines;
  }

  async create(data: {
    name: string;
    triggerPath: string;
    messageTemplate: string;
    agentName?: string;
    model?: string;
    channel?: string;
    deliver?: boolean;
  }): Promise<Routine> {
    if (!data.name?.trim()) throw new Error('name is required');
    if (!data.triggerPath?.trim()) throw new Error('triggerPath is required');
    if (!data.messageTemplate?.trim()) throw new Error('messageTemplate is required');

    const config = await readConfig();
    if (!config.hooks) config.hooks = { mappings: [] };
    if (!config.hooks.mappings) config.hooks.mappings = [];

    const hookPath = data.triggerPath.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const hook: HookMapping = {
      match: { path: hookPath },
      action: 'agent',
      wakeMode: 'now',
      name: data.name.trim(),
      sessionKey: `hook:${hookPath}:{{payload.id}}`,
      messageTemplate: data.messageTemplate.trim(),
      deliver: data.deliver ?? true,
      channel: data.channel ?? 'telegram',
      model: data.model,
      enabled: true,
    };

    config.hooks.mappings.push(hook);
    await writeConfig(config);
    logger.info({ name: data.name, path: hookPath }, '[RoutinesService] Hook created');

    return {
      id: `hook:${hookPath}`,
      name: data.name.trim(),
      description: `Webhook trigger: /${hookPath}`,
      type: 'hook',
      schedule: `Webhook /${hookPath}`,
      trigger: 'webhook',
      agentName: data.agentName,
      model: data.model,
      channel: data.channel ?? 'telegram',
      enabled: true,
      source: 'openclaw',
      config: hook as Record<string, unknown>,
    };
  }

  async delete(id: string): Promise<void> {
    if (!id.startsWith('hook:')) {
      throw new Error(`Cannot delete "${id}" — only hook routines can be removed from the app`);
    }
    const hookPath = id.slice('hook:'.length);
    const config = await readConfig();
    if (config.hooks?.mappings) {
      const before = config.hooks.mappings.length;
      config.hooks.mappings = config.hooks.mappings.filter((m) => m.match?.path !== hookPath);
      if (config.hooks.mappings.length === before) throw new Error(`Hook /${hookPath} not found`);
      await writeConfig(config);
    }
    logger.info({ id }, '[RoutinesService] Hook deleted');
  }

  async toggle(id: string, enabled: boolean): Promise<Routine | null> {
    if (!id.startsWith('hook:')) return null;
    const hookPath = id.slice('hook:'.length);
    const config = await readConfig();
    const mappings = config.hooks?.mappings ?? [];
    const idx = mappings.findIndex((m) => m.match?.path === hookPath);
    if (idx === -1) return null;
    mappings[idx]!.enabled = enabled;
    await writeConfig(config);
    const hook = mappings[idx]!;
    logger.info({ id, enabled }, '[RoutinesService] Hook toggled');
    return {
      id,
      name: hook.name ?? hookPath,
      description: hook.messageTemplate?.slice(0, 120) ?? `Webhook trigger: /${hookPath}`,
      type: 'hook',
      schedule: `Webhook /${hookPath}`,
      trigger: 'webhook',
      model: hook.model,
      channel: hook.channel,
      enabled,
      source: 'openclaw',
      config: hook as Record<string, unknown>,
    };
  }

  async runNow(id: string): Promise<{ result: string; status: 'success' | 'error'; error?: string }> {
    return {
      result: '',
      status: 'error',
      error: 'Run now is not supported for OpenClaw native routines — use the OpenClaw dashboard',
    };
  }

  async init(): Promise<void> {
    const routines = await this.list();
    logger.info({ count: routines.length }, '[RoutinesService] Loaded from OpenClaw config');
  }
}

export const automationsService = new AutomationsService();
