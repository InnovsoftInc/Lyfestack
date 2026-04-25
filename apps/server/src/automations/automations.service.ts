import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { cronRunner, type CronJob } from '../services/cron-runner.service';
import { notifyAutomationComplete } from './notify-on-complete';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
const OPENCLAW_CRON_FILE = path.join(OPENCLAW_DIR, 'cron', 'jobs.json');
const OPENCLAW_CRON_STATE = path.join(OPENCLAW_DIR, 'cron', 'jobs-state.json');
const WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace');

export interface Routine {
  id: string;
  name: string;
  description: string;
  type: 'heartbeat' | 'hook' | 'cron' | 'custom';
  schedule: string;
  trigger?: string | undefined;
  agent?: string | undefined;
  agentName?: string | undefined;
  prompt?: string | undefined;
  model?: string | undefined;
  channel?: string | undefined;
  enabled: boolean;
  source: 'openclaw' | 'lyfestack';
  lastRun?: string | undefined;
  lastRunStatus?: 'success' | 'error' | 'running' | undefined;
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
  channel?: string | undefined;
  to?: string;
  model?: string | undefined;
  enabled?: boolean;
  [key: string]: unknown;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      heartbeat?: {
        every: string;
        activeHours?: { start: string; end: string; timezone: string };
        model?: string | undefined;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
  hooks?: {
    mappings?: HookMapping[];
    [key: string]: unknown;
  };
  cron?: {
    jobs?: CronJob[];
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
            id: `cron:file:${relPath}:${i}`,
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

interface OpenClawCronJob {
  id: string;
  agentId?: string;
  name: string;
  enabled: boolean;
  createdAtMs?: number;
  schedule: { kind: string; expr: string; tz?: string; staggerMs?: number };
  sessionTarget?: string;
  wakeMode?: string;
  payload?: { kind: string; message?: string };
  delivery?: { mode?: string; channel?: string | undefined; to?: string };
  state?: Record<string, unknown>;
}

interface OpenClawCronState {
  [jobId: string]: { lastRunMs?: number; lastStatus?: string; nextRunMs?: number };
}

async function readOpenClawCronJobs(): Promise<Routine[]> {
  const routines: Routine[] = [];
  try {
    const raw = await fs.readFile(OPENCLAW_CRON_FILE, 'utf-8');
    const data = JSON.parse(raw) as { version?: number; jobs?: OpenClawCronJob[] };
    const jobs = data.jobs ?? [];

    let state: OpenClawCronState = {};
    try {
      state = JSON.parse(await fs.readFile(OPENCLAW_CRON_STATE, 'utf-8')) as OpenClawCronState;
    } catch { /* no state file */ }

    for (const job of jobs) {
      const cronExpr = job.schedule?.expr ?? '';
      const tz = job.schedule?.tz ? ` (${job.schedule.tz})` : '';
      const jobState = state[job.id];
      const lastRunMs = jobState?.lastRunMs;

      routines.push({
        id: `openclaw-cron:${job.id}`,
        name: job.name,
        description: job.payload?.message?.slice(0, 150) ?? '',
        type: 'cron',
        schedule: `${cronExpr}${tz}`,
        trigger: 'cron',
        agent: job.agentId,
        agentName: job.agentId,
        prompt: job.payload?.message,
        channel: job.delivery?.channel,
        enabled: job.enabled,
        source: 'openclaw',
        ...(lastRunMs && { lastRun: new Date(lastRunMs).toISOString() }),
        ...(jobState?.lastStatus && { lastRunStatus: jobState.lastStatus as 'success' | 'error' }),
        config: job as unknown as Record<string, unknown>,
      });
    }
  } catch (err) {
    logger.debug({ err }, '[AutomationsService] Could not read OpenClaw cron jobs');
  }
  return routines;
}

function cronJobToRoutine(job: CronJob): Routine {
  const lastRunRecord = cronRunner.getLastRun(job.id);
  return {
    id: `cron:${job.id}`,
    name: job.name,
    description: job.prompt ?? job.command ?? '',
    type: 'cron',
    schedule: job.schedule,
    trigger: 'cron',
    ...(job.agent !== undefined && { agent: job.agent, agentName: job.agent }),
    ...(job.prompt !== undefined && { prompt: job.prompt }),
    ...(job.notify?.channel !== undefined && { channel: job.notify.channel }),
    enabled: job.enabled,
    source: 'openclaw',
    ...(lastRunRecord?.finishedAt !== undefined && { lastRun: lastRunRecord.finishedAt }),
    ...(lastRunRecord?.status !== undefined && { lastRunStatus: lastRunRecord.status }),
    config: job as unknown as Record<string, unknown>,
  };
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
        ...(hb.model !== undefined && { model: hb.model as string }),
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
        ...(hook.model !== undefined && { model: hook.model }),
        ...(hook.channel !== undefined && { channel: hook.channel }),
        enabled: hook.enabled !== false,
        source: 'openclaw',
        config: hook as Record<string, unknown>,
      });
    }

    // 3. OpenClaw native cron jobs (~/.openclaw/cron/jobs.json)
    routines.push(...(await readOpenClawCronJobs()));

    // 4. Cron jobs from openclaw.json (legacy, if any)
    for (const job of config.cron?.jobs ?? []) {
      routines.push(cronJobToRoutine(job));
    }

    // 5. .cron files in workspace
    routines.push(...(await scanCronFiles()));

    return routines;
  }

  async create(data: {
    name: string;
    schedule: string;
    agent: string;
    prompt: string;
    enabled?: boolean;
    notify?: { channel: string };
  }): Promise<Routine> {
    if (!data.name?.trim()) throw new Error('name is required');
    if (!data.schedule?.trim()) throw new Error('schedule is required');
    if (!data.agent?.trim()) throw new Error('agent is required');
    if (!data.prompt?.trim()) throw new Error('prompt is required');

    const { default: nodeCron } = await import('node-cron');
    if (!nodeCron.validate(data.schedule)) throw new Error(`Invalid cron expression: ${data.schedule}`);

    const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const job: CronJob = {
      id,
      name: data.name.trim(),
      schedule: data.schedule.trim(),
      agent: data.agent.trim(),
      prompt: data.prompt.trim(),
      enabled: data.enabled ?? true,
      notify: data.notify ?? { channel: 'telegram' },
      logPath: `~/Library/Logs/${id}.log`,
    };

    cronRunner.upsertJob(job);
    logger.info({ id, name: job.name }, '[AutomationsService] Cron job created');
    return cronJobToRoutine(job);
  }

  async delete(id: string): Promise<void> {
    if (id.startsWith('cron:') && !id.startsWith('cron:file:')) {
      const jobId = id.slice('cron:'.length);
      cronRunner.deleteJob(jobId);
      logger.info({ id }, '[AutomationsService] Cron job deleted');
      return;
    }

    if (id.startsWith('hook:')) {
      const hookPath = id.slice('hook:'.length);
      const config = await readConfig();
      if (config.hooks?.mappings) {
        const before = config.hooks.mappings.length;
        config.hooks.mappings = config.hooks.mappings.filter((m) => m.match?.path !== hookPath);
        if (config.hooks.mappings.length === before) throw new Error(`Hook /${hookPath} not found`);
        await writeConfig(config);
      }
      logger.info({ id }, '[AutomationsService] Hook deleted');
      return;
    }

    throw new Error(`Cannot delete "${id}" — only cron jobs and hook routines can be removed from the app`);
  }

  async toggle(id: string, enabled: boolean): Promise<Routine | null> {
    if (id.startsWith('cron:') && !id.startsWith('cron:file:')) {
      const jobId = id.slice('cron:'.length);
      const updated = cronRunner.setEnabled(jobId, enabled);
      if (!updated) return null;
      logger.info({ id, enabled }, '[AutomationsService] Cron job toggled');
      return cronJobToRoutine(updated);
    }

    if (id.startsWith('hook:')) {
      const hookPath = id.slice('hook:'.length);
      const config = await readConfig();
      const mappings = config.hooks?.mappings ?? [];
      const idx = mappings.findIndex((m) => m.match?.path === hookPath);
      if (idx === -1) return null;
      mappings[idx]!.enabled = enabled;
      await writeConfig(config);
      const hook = mappings[idx]!;
      logger.info({ id, enabled }, '[AutomationsService] Hook toggled');
      return {
        id,
        name: hook.name ?? hookPath,
        description: hook.messageTemplate?.slice(0, 120) ?? `Webhook trigger: /${hookPath}`,
        type: 'hook',
        schedule: `Webhook /${hookPath}`,
        trigger: 'webhook',
        ...(hook.model !== undefined && { model: hook.model }),
        ...(hook.channel !== undefined && { channel: hook.channel }),
        enabled,
        source: 'openclaw',
        config: hook as Record<string, unknown>,
      };
    }

    return null;
  }

  async runNow(id: string): Promise<{ result: string; status: 'success' | 'error'; error?: string }> {
    if (id.startsWith('cron:') && !id.startsWith('cron:file:')) {
      const jobId = id.slice('cron:'.length);
      try {
        const record = await cronRunner.runJob(jobId);
        const base = {
          result: record.status === 'success' ? 'Job completed successfully' : '',
          status: (record.status === 'running' ? 'success' : record.status) as 'success' | 'error',
        };
        const out = record.error !== undefined ? { ...base, error: record.error } : base;
        // Fire-and-forget AI summary push. Failures must never break run reporting.
        void notifyAutomationComplete(id, out).catch(() => undefined);
        return out;
      } catch (err: unknown) {
        const out = { result: '', status: 'error' as const, error: err instanceof Error ? err.message : String(err) };
        void notifyAutomationComplete(id, out).catch(() => undefined);
        return out;
      }
    }

    return { result: '', status: 'error', error: 'Run now is only supported for cron jobs' };
  }

  async getRunHistory(id: string): Promise<ReturnType<typeof cronRunner.getHistory>> {
    if (id.startsWith('cron:') && !id.startsWith('cron:file:')) {
      const jobId = id.slice('cron:'.length);
      return cronRunner.getHistory(jobId);
    }
    return [];
  }

  async init(): Promise<void> {
    const routines = await this.list();
    logger.info({ count: routines.length }, '[AutomationsService] Loaded from OpenClaw config');
  }
}

export const automationsService = new AutomationsService();
