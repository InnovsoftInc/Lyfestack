import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

export interface Routine {
  id: string;
  name: string;
  description: string;
  type: 'heartbeat' | 'hook' | 'cron' | 'custom';
  schedule: string;
  trigger?: string | undefined;
  agentName?: string | undefined;
  model?: string | undefined;
  channel?: string | undefined;
  enabled: boolean;
  source: 'openclaw' | 'lyfestack';
  lastRun?: string | undefined;
  config?: Record<string, unknown>;
}

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
const WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace');

interface HookMapping {
  match: { path: string };
  name?: string;
  messageTemplate?: string;
  model?: string | undefined;
  channel?: string | undefined;
  enabled?: boolean;
  [key: string]: unknown;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      heartbeat?: {
        every?: string;
        activeHours?: { start: string; end: string; timezone: string };
        model?: string | undefined;
        [key: string]: unknown;
      };
    };
  };
  hooks?: { mappings?: HookMapping[] };
  [key: string]: unknown;
}

function readConfig(): OpenClawConfig {
  try {
    return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8')) as OpenClawConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: OpenClawConfig): void {
  fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), 'utf-8');
}

function formatInterval(every: string): string {
  const m = every.match(/^(\d+)([smhd])$/);
  if (!m) return every;
  const labels: Record<string, string> = { s: 'sec', m: 'min', h: 'hr', d: 'day' };
  const n = Number(m[1]);
  const unit = labels[m[2]!] ?? m[2]!;
  return `Every ${n} ${unit}${n !== 1 ? 's' : ''}`;
}

function scanCronFiles(): Routine[] {
  const routines: Routine[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.cron')) {
        let content: string;
        try {
          content = fs.readFileSync(full, 'utf-8');
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

  walk(WORKSPACE_DIR);
  return routines;
}

class RoutinesService {
  init(): void {
    const routines = this.listRoutines();
    logger.info({ count: routines.length }, '[RoutinesService] Loaded from OpenClaw config');
  }

  listRoutines(): Routine[] {
    const config = readConfig();
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
        description: `${formatInterval(hb.every ?? '0m')}${activeStr}`,
        type: 'heartbeat',
        schedule: formatInterval(hb.every ?? '0m'),
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
    routines.push(...scanCronFiles());

    return routines;
  }

  createRoutine(data: {
    name: string;
    triggerPath: string;
    messageTemplate: string;
    agentName?: string | undefined;
    model?: string | undefined;
    channel?: string | undefined;
    deliver?: boolean;
  }): Routine {
    if (!data.name?.trim()) throw new Error('name is required');
    if (!data.triggerPath?.trim()) throw new Error('triggerPath is required');
    if (!data.messageTemplate?.trim()) throw new Error('messageTemplate is required');

    const config = readConfig();
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
    writeConfig(config);

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

  deleteRoutine(id: string): void {
    if (!id.startsWith('hook:')) throw new Error('Only hook routines can be deleted from the app');
    const hookPath = id.slice('hook:'.length);
    const config = readConfig();
    if (config.hooks?.mappings) {
      const before = config.hooks.mappings.length;
      config.hooks.mappings = config.hooks.mappings.filter((m) => m.match?.path !== hookPath);
      if (config.hooks.mappings.length === before) throw new Error(`Hook /${hookPath} not found`);
      writeConfig(config);
    }
  }

  toggleRoutine(id: string, enabled: boolean): Routine | null {
    if (!id.startsWith('hook:')) return null;
    const hookPath = id.slice('hook:'.length);
    const config = readConfig();
    const mappings = config.hooks?.mappings ?? [];
    const idx = mappings.findIndex((m) => m.match?.path === hookPath);
    if (idx === -1) return null;
    mappings[idx]!.enabled = enabled;
    writeConfig(config);
    const hook = mappings[idx]!;
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


  updateRoutine(id: string, updates: Partial<Routine>): Routine | null {
    if (typeof updates.enabled === 'boolean') return this.toggleRoutine(id, updates.enabled);
    return this.listRoutines().find((routine) => routine.id === id) ?? null;
  }

  async runNow(id: string): Promise<{ id: string; status: 'success'; result: string }> {
    return { id, status: 'success', result: 'Manual run is not implemented for OpenClaw-backed routines yet.' };
  }

  getRunHistory(_id: string): unknown[] {
    return [];
  }

  updateHeartbeat(updates: {
    every?: string;
    activeHours?: { start: string; end: string; timezone: string };
    model?: string | undefined;
  }): void {
    const config = readConfig();
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    config.agents.defaults.heartbeat = {
      ...config.agents.defaults.heartbeat,
      ...updates,
    };
    writeConfig(config);
  }
}

export const routinesService = new RoutinesService();
