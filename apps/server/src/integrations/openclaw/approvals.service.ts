import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import { OPENCLAW_HOME } from './openclaw-json';

const APPROVALS_FILE = path.join(OPENCLAW_HOME, 'exec-approvals.json');
const LOGS_DIR = path.join(OPENCLAW_HOME, 'logs');

export interface AllowlistEntry {
  id: string;
  pattern: string;
  source: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

export interface ApprovalsDefaults {
  security: string;
  ask: string;
  askFallback: string;
}

export interface ApprovalsConfig {
  version: number;
  defaults: ApprovalsDefaults;
  agents: Record<string, { allowlist: AllowlistEntry[] }>;
}

interface RawApprovals extends ApprovalsConfig {
  socket?: { path: string; token: string };
}

let writeQueue: Promise<void> = Promise.resolve();

async function readRaw(): Promise<RawApprovals> {
  try {
    const raw = await fs.readFile(APPROVALS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      defaults: {
        security: parsed.defaults?.security ?? 'full',
        ask: parsed.defaults?.ask ?? 'off',
        askFallback: parsed.defaults?.askFallback ?? 'full',
      },
      agents: parsed.agents ?? {},
      socket: parsed.socket,
    };
  } catch {
    return {
      version: 1,
      defaults: { security: 'full', ask: 'off', askFallback: 'full' },
      agents: {},
    };
  }
}

async function writeRaw(data: RawApprovals): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const json = JSON.stringify(data, null, 2);
    const tmp = `${APPROVALS_FILE}.tmp`;
    await fs.writeFile(tmp, json);
    await fs.rename(tmp, APPROVALS_FILE);
  });
  return writeQueue;
}

export async function getApprovalsConfig(): Promise<ApprovalsConfig & { hasSocket: boolean }> {
  const raw = await readRaw();
  return {
    version: raw.version,
    defaults: raw.defaults,
    agents: raw.agents,
    hasSocket: Boolean(raw.socket?.path),
  };
}

export async function setDefaults(patch: Partial<ApprovalsDefaults>): Promise<ApprovalsDefaults> {
  const raw = await readRaw();
  raw.defaults = { ...raw.defaults, ...patch };
  await writeRaw(raw);
  return raw.defaults;
}

export async function listAllowlist(agent?: string): Promise<Record<string, AllowlistEntry[]>> {
  const raw = await readRaw();
  if (agent) {
    const entries = raw.agents[agent]?.allowlist ?? [];
    return { [agent]: entries };
  }
  const result: Record<string, AllowlistEntry[]> = {};
  for (const [name, info] of Object.entries(raw.agents)) {
    result[name] = info.allowlist ?? [];
  }
  return result;
}

export async function addAllowlistEntry(
  agent: string,
  pattern: string,
  source: string = 'allow-always',
): Promise<AllowlistEntry> {
  if (!agent || !pattern) throw new Error('agent and pattern are required');
  const raw = await readRaw();
  if (!raw.agents[agent]) raw.agents[agent] = { allowlist: [] };
  const existing = raw.agents[agent].allowlist.find((e) => e.pattern === pattern);
  if (existing) return existing;
  const entry: AllowlistEntry = {
    id: randomUUID(),
    pattern,
    source,
    lastUsedAt: Date.now(),
  };
  raw.agents[agent].allowlist.push(entry);
  await writeRaw(raw);
  logger.info({ agent, pattern, id: entry.id }, 'approvals: added allowlist entry');
  return entry;
}

export async function removeAllowlistEntry(agent: string, id: string): Promise<boolean> {
  const raw = await readRaw();
  const list = raw.agents[agent]?.allowlist;
  if (!list) return false;
  const before = list.length;
  raw.agents[agent]!.allowlist = list.filter((e) => e.id !== id);
  if (raw.agents[agent]!.allowlist.length === before) return false;
  await writeRaw(raw);
  logger.info({ agent, id }, 'approvals: removed allowlist entry');
  return true;
}

export interface PendingApproval {
  id: string;
  agent: string;
  command: string;
  resolvedPath?: string;
  pattern?: string;
  requestedAt: string;
  source: 'log' | 'socket';
  raw?: Record<string, unknown>;
  classification?: 'safe' | 'review' | 'dangerous';
  rationale?: string;
}

const APPROVAL_LOG_PATTERN = /awaiting[_-]approval/i;

async function tailFile(filepath: string, maxBytes = 64 * 1024): Promise<string> {
  try {
    const stat = await fs.stat(filepath);
    const start = Math.max(0, stat.size - maxBytes);
    const handle = await fs.open(filepath, 'r');
    try {
      const buf = Buffer.alloc(stat.size - start);
      await handle.read(buf, 0, buf.length, start);
      return buf.toString('utf-8');
    } finally {
      await handle.close();
    }
  } catch {
    return '';
  }
}

/**
 * Best-effort scan of recent log output for `awaiting_approval` events.
 * The OpenClaw daemon serves the authoritative socket — this is a read-only
 * preview surface so the mobile app can show "something is asking" before
 * the socket integration lands.
 */
export async function listPending(): Promise<PendingApproval[]> {
  let entries: string[] = [];
  try { entries = await fs.readdir(LOGS_DIR); } catch { return []; }
  const candidates = entries.filter((n) => /\.(log|jsonl)$/i.test(n));
  const results: PendingApproval[] = [];
  for (const name of candidates) {
    const text = await tailFile(path.join(LOGS_DIR, name));
    if (!APPROVAL_LOG_PATTERN.test(text)) continue;
    const lines = text.split('\n');
    for (const line of lines) {
      if (!APPROVAL_LOG_PATTERN.test(line)) continue;
      let parsed: Record<string, unknown> = {};
      const jsonStart = line.indexOf('{');
      if (jsonStart >= 0) {
        try { parsed = JSON.parse(line.slice(jsonStart)); } catch { /* keep empty */ }
      }
      const command = (parsed.command as string) ?? (parsed.cmd as string) ?? line.slice(0, 200);
      const item: PendingApproval = {
        id: `${name}:${results.length}`,
        agent: (parsed.agent as string) ?? 'unknown',
        command,
        requestedAt: (parsed.timestamp as string) ?? new Date().toISOString(),
        source: 'log',
        raw: parsed,
      };
      if (typeof parsed.resolvedPath === 'string') item.resolvedPath = parsed.resolvedPath;
      if (typeof parsed.pattern === 'string') item.pattern = parsed.pattern;
      results.push(item);
    }
  }
  // Most recent first, dedupe by command+agent
  results.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.agent}::${r.command}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}

export interface DecideInput {
  agent: string;
  pattern: string;
  decision: 'approve' | 'reject' | 'allow-always';
  notes?: string;
}

/**
 * For now, decisions translate to allowlist mutations. A future revision will
 * also write to the unix socket at `exec-approvals.sock` for live prompts.
 */
export async function decide(input: DecideInput): Promise<{ ok: true; entry?: AllowlistEntry }> {
  if (input.decision === 'allow-always') {
    const entry = await addAllowlistEntry(input.agent, input.pattern, 'allow-always');
    return { ok: true, entry };
  }
  if (input.decision === 'approve') {
    // Single approval — also recorded so it shows up in lastUsedAt history.
    const entry = await addAllowlistEntry(input.agent, input.pattern, 'allow-once');
    return { ok: true, entry };
  }
  // reject — no allowlist mutation; future: send to socket
  logger.info({ agent: input.agent, pattern: input.pattern }, 'approvals: rejected');
  return { ok: true };
}
