import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger';

const OPENCLAW_ROOT = path.join(process.env.HOME ?? '', '.openclaw');
const OPENCLAW_AGENTS_DIR = path.join(OPENCLAW_ROOT, 'agents');
const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_ROOT, 'openclaw.json');

const UUID_JSONL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Fallback context window by model-id pattern. Only used when neither
// sessions.json nor openclaw.json declares a contextWindow for the model.
const CONTEXT_WINDOW_FALLBACKS: Array<[RegExp, number]> = [
  [/^claude-opus/i, 200_000],
  [/^claude-sonnet/i, 200_000],
  [/^claude-haiku/i, 200_000],
  [/^anthropic\//i, 200_000],
  [/^codex\//i, 272_000],
  [/^gpt-5/i, 272_000],
  [/^gpt-4/i, 128_000],
  [/^openai\//i, 128_000],
  [/^llama/i, 131_072],
  [/^mistral/i, 32_768],
];
const DEFAULT_CONTEXT_WINDOW = 128_000;

export interface SessionUsage {
  totalTokens: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  lastCacheReadTokens: number;
  contextUsedTokens: number;
  totalTokensFresh: boolean;
}

export interface SessionSummary {
  key: string;
  agentId: string;
  sessionId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  contextWindow: number;
  usage: SessionUsage;
  compactionCount: number;
}

export interface SessionMessage {
  index: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export interface SessionDetail {
  key: string;
  messages: SessionMessage[];
  total: number;
  firstIndex: number;
  lastIndex: number;
  model: string;
  contextWindow: number;
  usage: SessionUsage;
  compactionCount: number;
}

export interface SessionActionResult {
  ok: boolean;
  session?: SessionSummary;
  error?: string;
}

interface IndexEntry {
  sessionId: string;
  updatedAt?: number;
  label?: string;
  model?: string;
  contextTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  compactionCount?: number;
}

const EMPTY_USAGE: SessionUsage = {
  totalTokens: 0,
  lastInputTokens: 0,
  lastOutputTokens: 0,
  lastCacheReadTokens: 0,
  contextUsedTokens: 0,
  totalTokensFresh: false,
};

function stripSenderMetadata(text: string): string {
  const match = text.match(/^Sender \(untrusted metadata\):\n```json\n[\s\S]*?\n```\n\n(?:\[[^\]]+\]\s*)?([\s\S]*)$/);
  return (match?.[1] ?? text).trim();
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text as string)
    .join('\n')
    .trim();
}

async function readFirstUserMessage(filePath: string): Promise<string> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry?.type !== 'message') continue;
        if (entry?.message?.role !== 'user') continue;
        const text = stripSenderMetadata(extractText(entry.message.content));
        if (text) return text;
      } catch { /* skip malformed line */ }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return '';
}

async function listAgentNames(): Promise<string[]> {
  try {
    const entries = await fsp.readdir(OPENCLAW_AGENTS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listSessionFilesForAgent(agentId: string): Promise<Array<{ sessionId: string; filePath: string; mtime: Date }>> {
  const dir = path.join(OPENCLAW_AGENTS_DIR, agentId, 'sessions');
  let files: string[];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return [];
  }
  const results = await Promise.all(
    files
      .filter((f) => UUID_JSONL.test(f))
      .map(async (f) => {
        const filePath = path.join(dir, f);
        try {
          const stat = await fsp.stat(filePath);
          return { sessionId: f.replace(/\.jsonl$/, ''), filePath, mtime: stat.mtime };
        } catch {
          return null;
        }
      })
  );
  return results.filter((r): r is { sessionId: string; filePath: string; mtime: Date } => r !== null);
}

// Read {agent}/sessions/sessions.json and collapse to one entry per sessionId
// (keep the most-recently-updated entry when multiple external keys point at
// the same session).
async function readSessionsIndex(agentId: string): Promise<Map<string, IndexEntry>> {
  const file = path.join(OPENCLAW_AGENTS_DIR, agentId, 'sessions', 'sessions.json');
  let raw: string;
  try {
    raw = await fsp.readFile(file, 'utf-8');
  } catch {
    return new Map();
  }
  let obj: Record<string, any>;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    logger.warn({ err, agentId }, 'sessions.json parse failed');
    return new Map();
  }
  const out = new Map<string, IndexEntry>();
  for (const v of Object.values(obj ?? {})) {
    if (!v || typeof v !== 'object') continue;
    const entry = v as any;
    const sid = entry.sessionId;
    if (typeof sid !== 'string' || !UUID.test(sid)) continue;
    const ie: IndexEntry = {
      sessionId: sid,
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : undefined,
      label: typeof entry.label === 'string' ? entry.label : undefined,
      model: typeof entry.model === 'string' ? entry.model : undefined,
      contextTokens: typeof entry.contextTokens === 'number' ? entry.contextTokens : undefined,
      inputTokens: typeof entry.inputTokens === 'number' ? entry.inputTokens : undefined,
      outputTokens: typeof entry.outputTokens === 'number' ? entry.outputTokens : undefined,
      cacheReadTokens: typeof entry.cacheReadTokens === 'number' ? entry.cacheReadTokens
        : typeof entry.cacheRead === 'number' ? entry.cacheRead : undefined,
      totalTokens: typeof entry.totalTokens === 'number' ? entry.totalTokens : undefined,
      totalTokensFresh: typeof entry.totalTokensFresh === 'boolean' ? entry.totalTokensFresh : undefined,
      compactionCount: typeof entry.compactionCount === 'number' ? entry.compactionCount : undefined,
    };
    const prev = out.get(sid);
    if (!prev || (ie.updatedAt ?? 0) > (prev.updatedAt ?? 0)) {
      out.set(sid, ie);
    }
  }
  return out;
}

let configCache: { at: number; models: Map<string, number> } | null = null;
const CONFIG_CACHE_MS = 30_000;

async function loadModelContextWindows(): Promise<Map<string, number>> {
  if (configCache && Date.now() - configCache.at < CONFIG_CACHE_MS) return configCache.models;
  const map = new Map<string, number>();
  try {
    const raw = await fsp.readFile(OPENCLAW_CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);
    const providers = cfg?.models?.providers ?? cfg?.models ?? {};
    for (const [providerId, provider] of Object.entries(providers as Record<string, any>)) {
      const models = (provider as any)?.models;
      if (!Array.isArray(models)) continue;
      for (const m of models) {
        const cw = m?.contextWindow;
        if (typeof cw !== 'number' || cw <= 0) continue;
        const id = typeof m?.id === 'string' ? m.id : null;
        if (!id) continue;
        map.set(`${providerId}/${id}`, cw);
        map.set(id, cw);
      }
    }
  } catch { /* config missing or unreadable — fallbacks apply */ }
  configCache = { at: Date.now(), models: map };
  return map;
}

function resolveContextWindowSync(model: string, models: Map<string, number>, overrideFromIndex?: number): number {
  if (typeof overrideFromIndex === 'number' && overrideFromIndex > 0) return overrideFromIndex;
  if (!model) return DEFAULT_CONTEXT_WINDOW;
  const direct = models.get(model);
  if (direct) return direct;
  const bareId = model.includes('/') ? model.split('/').slice(1).join('/') : model;
  const bare = models.get(bareId);
  if (bare) return bare;
  for (const [re, cw] of CONTEXT_WINDOW_FALLBACKS) {
    if (re.test(model)) return cw;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

function buildUsageFromIndex(ie: IndexEntry | undefined): SessionUsage {
  if (!ie) return { ...EMPTY_USAGE };
  const inputTokens = ie.inputTokens ?? 0;
  const cacheReadTokens = ie.cacheReadTokens ?? 0;
  return {
    totalTokens: ie.totalTokens ?? 0,
    lastInputTokens: inputTokens,
    lastOutputTokens: ie.outputTokens ?? 0,
    lastCacheReadTokens: cacheReadTokens,
    contextUsedTokens: inputTokens + cacheReadTokens,
    totalTokensFresh: ie.totalTokensFresh ?? false,
  };
}

export async function listSessions(opts: { agentId?: string; limit?: number } = {}): Promise<SessionSummary[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 500);
  const agents = opts.agentId ? [opts.agentId] : await listAgentNames();
  const models = await loadModelContextWindows();
  const all = await Promise.all(
    agents.map(async (agentId) => {
      const [files, index] = await Promise.all([
        listSessionFilesForAgent(agentId),
        readSessionsIndex(agentId),
      ]);
      return Promise.all(
        files.map(async (f) => {
          const ie = index.get(f.sessionId);
          const label = (ie?.label && ie.label.trim())
            ? ie.label.trim().slice(0, 80)
            : (await readFirstUserMessage(f.filePath).catch(() => '')).slice(0, 80) || '(empty)';
          const updatedAt = ie?.updatedAt ? new Date(ie.updatedAt).toISOString() : f.mtime.toISOString();
          const model = ie?.model ?? '';
          const contextWindow = resolveContextWindowSync(model, models, ie?.contextTokens);
          return {
            key: `${agentId}/${f.sessionId}`,
            agentId,
            sessionId: f.sessionId,
            label,
            createdAt: f.mtime.toISOString(),
            updatedAt,
            model,
            contextWindow,
            usage: buildUsageFromIndex(ie),
            compactionCount: ie?.compactionCount ?? 0,
          } satisfies SessionSummary;
        })
      );
    })
  );
  return all.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

function parseKey(key: string): { agentId: string; sessionId: string } | null {
  const idx = key.indexOf('/');
  if (idx <= 0) return null;
  const agentId = key.slice(0, idx);
  const sessionId = key.slice(idx + 1);
  if (!UUID.test(sessionId)) return null;
  return { agentId, sessionId };
}

export async function getSession(
  key: string,
  opts: { limit?: number; beforeIndex?: number; afterIndex?: number } = {},
): Promise<SessionDetail | null> {
  const parsed = parseKey(key);
  if (!parsed) return null;
  const filePath = path.join(OPENCLAW_AGENTS_DIR, parsed.agentId, 'sessions', `${parsed.sessionId}.jsonl`);

  let stream: fs.ReadStream;
  try {
    stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  } catch (err) {
    logger.error({ err, key }, 'Failed to open session file');
    return null;
  }

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const all: SessionMessage[] = [];
  let lastAssistantUsage: { input?: number; output?: number; cacheRead?: number; totalTokens?: number } | null = null;
  let lastModel = '';

  try {
    for await (const line of rl) {
      if (!line) continue;
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry?.type !== 'message') continue;
      const role = entry.message?.role;
      if (role === 'assistant') {
        const u = entry.message?.usage;
        if (u && typeof u === 'object') lastAssistantUsage = u;
        if (typeof entry.message?.model === 'string') lastModel = entry.message.model;
      }
      if (role !== 'user' && role !== 'assistant') continue;
      const text = extractText(entry.message?.content);
      if (!text) continue;
      all.push({
        index: all.length,
        role: role === 'user' ? 'user' : 'agent',
        content: role === 'user' ? stripSenderMetadata(text) : text,
        timestamp: entry.timestamp ?? new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err, key }, 'Failed to read session file');
  } finally {
    rl.close();
    stream.destroy();
  }

  const total = all.length;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  let slice: SessionMessage[];

  if (opts.afterIndex !== undefined) {
    slice = all.slice(opts.afterIndex + 1);
  } else if (opts.beforeIndex !== undefined) {
    const end = Math.max(0, Math.min(opts.beforeIndex, total));
    slice = all.slice(Math.max(0, end - limit), end);
  } else {
    slice = all.slice(Math.max(0, total - limit));
  }

  const [index, models] = await Promise.all([
    readSessionsIndex(parsed.agentId),
    loadModelContextWindows(),
  ]);
  const ie = index.get(parsed.sessionId);
  const model = ie?.model ?? lastModel ?? '';
  const contextWindow = resolveContextWindowSync(model, models, ie?.contextTokens);

  const usage: SessionUsage = lastAssistantUsage
    ? {
        totalTokens: ie?.totalTokens ?? lastAssistantUsage.totalTokens ?? 0,
        lastInputTokens: lastAssistantUsage.input ?? 0,
        lastOutputTokens: lastAssistantUsage.output ?? 0,
        lastCacheReadTokens: lastAssistantUsage.cacheRead ?? 0,
        contextUsedTokens: (lastAssistantUsage.input ?? 0) + (lastAssistantUsage.cacheRead ?? 0),
        totalTokensFresh: ie?.totalTokensFresh ?? true,
      }
    : buildUsageFromIndex(ie);

  return {
    key,
    messages: slice,
    total,
    firstIndex: slice[0]?.index ?? -1,
    lastIndex: slice[slice.length - 1]?.index ?? -1,
    model,
    contextWindow,
    usage,
    compactionCount: ie?.compactionCount ?? 0,
  };
}

async function agentExists(agentId: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(path.join(OPENCLAW_AGENTS_DIR, agentId));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function createSession(agentId: string): Promise<SessionActionResult> {
  if (!agentId || !/^[a-zA-Z0-9_.-]+$/.test(agentId)) {
    return { ok: false, error: 'invalid agentId' };
  }
  if (!(await agentExists(agentId))) {
    return { ok: false, error: 'agent not found' };
  }
  const sessionsDir = path.join(OPENCLAW_AGENTS_DIR, agentId, 'sessions');
  await fsp.mkdir(sessionsDir, { recursive: true });
  const sessionId = crypto.randomUUID();
  const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
  try {
    await fsp.writeFile(filePath, '', { flag: 'wx' });
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      return createSession(agentId);
    }
    return { ok: false, error: err?.message ?? 'failed to create session file' };
  }
  const models = await loadModelContextWindows();
  const now = new Date();
  const summary: SessionSummary = {
    key: `${agentId}/${sessionId}`,
    agentId,
    sessionId,
    label: '(new session)',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    model: '',
    contextWindow: resolveContextWindowSync('', models),
    usage: { ...EMPTY_USAGE },
    compactionCount: 0,
  };
  return { ok: true, session: summary };
}

export async function deleteSession(key: string): Promise<SessionActionResult> {
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, error: 'invalid key' };
  const sessionsDir = path.join(OPENCLAW_AGENTS_DIR, parsed.agentId, 'sessions');
  const filePath = path.join(sessionsDir, `${parsed.sessionId}.jsonl`);
  try {
    await fsp.access(filePath);
  } catch {
    return { ok: false, error: 'session not found' };
  }
  const archived = `${filePath}.bak.${Date.now()}`;
  try {
    await fsp.rename(filePath, archived);
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'failed to archive session' };
  }

  // Best-effort: prune matching entry from sessions.json so it no longer
  // shows up in future listSessions() calls.
  const indexPath = path.join(sessionsDir, 'sessions.json');
  try {
    const raw = await fsp.readFile(indexPath, 'utf-8');
    const obj = JSON.parse(raw);
    let changed = false;
    for (const [k, v] of Object.entries(obj ?? {})) {
      if ((v as any)?.sessionId === parsed.sessionId) {
        delete (obj as any)[k];
        changed = true;
      }
    }
    if (changed) await fsp.writeFile(indexPath, JSON.stringify(obj, null, 2));
  } catch { /* index missing or unreadable — jsonl rename is enough */ }

  return { ok: true };
}
