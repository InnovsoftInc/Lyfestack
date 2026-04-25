// Phase 2: LyfeStack-native chat threads.
//
// A thread is the user-visible chat history. It is decoupled from OpenClaw
// sessions so that automatic session rollover (before compaction) preserves a
// single continuous conversation from the user's point of view.
//
// Storage:
//   ~/.openclaw/threads/{agentName}.json          — thread metadata
//   ~/.openclaw/threads/{agentName}.messages.jsonl — append-only messages
//
// Phase 2 uses one thread per agent, keyed by agent name. The metadata
// carries its own stable threadId so a future migration to multiple threads
// per agent can move to {threadId}/ directories without re-identifying.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger';
import {
  createSession,
  getSession,
  listSessions,
  type SessionSummary,
} from './sessions.service';

const OPENCLAW_ROOT = path.join(process.env.HOME ?? '', '.openclaw');
const THREADS_DIR = path.join(OPENCLAW_ROOT, 'threads');

// Mirror of the mobile UX thresholds. Keep in sync with
// apps/mobile/app/(auth)/(drawer)/agents/[name]/chat.tsx.
const SESSION_ROLLOVER_THRESHOLD = 0.82;

export type ThreadRole = 'user' | 'agent';

export interface ThreadAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  uri?: string;
}

export interface ThreadMessage {
  id: string;
  role: ThreadRole;
  content: string;
  timestamp: string;
  sessionKey?: string;
  isError?: boolean;
  errorType?: string;
  attachments?: ThreadAttachment[];
}

export interface Thread {
  threadId: string;
  agentName: string;
  title: string;
  activeSessionKey: string | null;
  sessionChain: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreadDetail extends Thread {
  messages: ThreadMessage[];
  total: number;
  activeSession?: SessionSummary | null;
}

const AGENT_NAME_RE = /^[a-zA-Z0-9_.-]+$/;

function validateAgentName(agentName: string): void {
  if (!AGENT_NAME_RE.test(agentName)) {
    throw new Error(`invalid agent name: ${agentName}`);
  }
}

function threadMetaPath(agentName: string): string {
  return path.join(THREADS_DIR, `${agentName}.json`);
}

function threadMessagesPath(agentName: string): string {
  return path.join(THREADS_DIR, `${agentName}.messages.jsonl`);
}

async function ensureDir(): Promise<void> {
  await fsp.mkdir(THREADS_DIR, { recursive: true });
}

// Serialize thread-meta writes per agent so concurrent append + rollover
// calls don't overwrite each other. Each agent gets its own promise chain.
const metaWriteQueues = new Map<string, Promise<void>>();

function queueMetaWrite(agentName: string, op: () => Promise<void>): Promise<void> {
  const prev = metaWriteQueues.get(agentName) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(op);
  metaWriteQueues.set(agentName, next);
  void next.finally(() => {
    if (metaWriteQueues.get(agentName) === next) metaWriteQueues.delete(agentName);
  });
  return next;
}

async function readThreadMeta(agentName: string): Promise<Thread | null> {
  try {
    const raw = await fsp.readFile(threadMetaPath(agentName), 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const t: Thread = {
      threadId: String(obj.threadId ?? ''),
      agentName: String(obj.agentName ?? agentName),
      title: String(obj.title ?? ''),
      activeSessionKey: obj.activeSessionKey ?? null,
      sessionChain: Array.isArray(obj.sessionChain) ? obj.sessionChain.map(String) : [],
      createdAt: String(obj.createdAt ?? new Date().toISOString()),
      updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
    };
    if (!t.threadId) return null;
    return t;
  } catch {
    return null;
  }
}

async function writeThreadMeta(thread: Thread): Promise<void> {
  await ensureDir();
  const tmp = `${threadMetaPath(thread.agentName)}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(thread, null, 2));
  await fsp.rename(tmp, threadMetaPath(thread.agentName));
}

async function appendMessageLine(agentName: string, message: ThreadMessage): Promise<void> {
  await ensureDir();
  const line = JSON.stringify(message) + '\n';
  await fsp.appendFile(threadMessagesPath(agentName), line, 'utf-8');
}

async function readAllMessages(agentName: string): Promise<ThreadMessage[]> {
  const filePath = threadMessagesPath(agentName);
  try {
    await fsp.access(filePath);
  } catch {
    return [];
  }
  const out: ThreadMessage[] = [];
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (!entry || typeof entry !== 'object') continue;
        if (entry.role !== 'user' && entry.role !== 'agent') continue;
        const msg: ThreadMessage = {
          id: String(entry.id),
          role: entry.role,
          content: String(entry.content ?? ''),
          timestamp: String(entry.timestamp ?? ''),
        };
        if (entry.sessionKey) msg.sessionKey = String(entry.sessionKey);
        if (entry.isError) msg.isError = true;
        if (entry.errorType) msg.errorType = String(entry.errorType);
        if (Array.isArray(entry.attachments)) {
          msg.attachments = entry.attachments
            .filter((attachment: any) => attachment && typeof attachment === 'object')
            .map((attachment: any) => ({
              id: String(attachment.id ?? crypto.randomUUID()),
              name: String(attachment.name ?? 'attachment'),
              type: attachment.type === 'image' ? 'image' : attachment.type === 'text' ? 'text' : 'file',
              mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
              size: Number(attachment.size ?? 0) || 0,
              ...(attachment.uri ? { uri: String(attachment.uri) } : {}),
            }));
        }
        out.push(msg);
      } catch {
        /* skip malformed line */
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return out;
}

// Create a thread if one does not yet exist. Caller decides whether to seed
// with an activeSessionKey (typically only on first interaction).
export async function getOrCreateThread(agentName: string): Promise<Thread> {
  validateAgentName(agentName);
  const existing = await readThreadMeta(agentName);
  if (existing) return existing;
  const now = new Date().toISOString();
  const thread: Thread = {
    threadId: crypto.randomUUID(),
    agentName,
    title: '(new thread)',
    activeSessionKey: null,
    sessionChain: [],
    createdAt: now,
    updatedAt: now,
  };
  await queueMetaWrite(agentName, () => writeThreadMeta(thread));
  logger.info({ agentName, threadId: thread.threadId }, 'thread created');
  return thread;
}

export async function getThread(
  agentName: string,
  opts: { limit?: number; beforeId?: string; afterId?: string; includeSession?: boolean } = {},
): Promise<ThreadDetail | null> {
  validateAgentName(agentName);
  const meta = await readThreadMeta(agentName);
  if (!meta) return null;

  const all = await readAllMessages(agentName);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);

  let slice: ThreadMessage[];
  if (opts.afterId) {
    const idx = all.findIndex((m) => m.id === opts.afterId);
    slice = idx === -1 ? all.slice(-limit) : all.slice(idx + 1);
  } else if (opts.beforeId) {
    const idx = all.findIndex((m) => m.id === opts.beforeId);
    const end = idx === -1 ? all.length : idx;
    slice = all.slice(Math.max(0, end - limit), end);
  } else {
    slice = all.slice(Math.max(0, all.length - limit));
  }

  let activeSession: SessionSummary | null = null;
  if (opts.includeSession !== false && meta.activeSessionKey) {
    try {
      const detail = await getSession(meta.activeSessionKey, { limit: 1 });
      if (detail) {
        activeSession = {
          key: detail.key,
          agentId: meta.agentName,
          sessionId: detail.key.split('/').slice(1).join('/'),
          label: '',
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          model: detail.model,
          contextWindow: detail.contextWindow,
          usage: detail.usage,
          compactionCount: detail.compactionCount,
        };
      }
    } catch { /* ignore — best-effort */ }
  }

  return {
    ...meta,
    messages: slice,
    total: all.length,
    activeSession,
  };
}

export async function listThreads(): Promise<Thread[]> {
  try {
    await ensureDir();
    const entries = await fsp.readdir(THREADS_DIR);
    const metas = await Promise.all(
      entries
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .map((f) => f.replace(/\.json$/, ''))
        .map((agentName) => readThreadMeta(agentName)),
    );
    return metas
      .filter((m): m is Thread => Boolean(m))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function appendMessage(
  agentName: string,
  partial: Omit<ThreadMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): Promise<ThreadMessage> {
  validateAgentName(agentName);
  await getOrCreateThread(agentName);
  const message: ThreadMessage = {
    id: partial.id ?? crypto.randomUUID(),
    role: partial.role,
    content: partial.content,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    ...(partial.sessionKey ? { sessionKey: partial.sessionKey } : {}),
    ...(partial.isError ? { isError: true } : {}),
    ...(partial.errorType ? { errorType: partial.errorType } : {}),
    ...(partial.attachments?.length ? {
      attachments: partial.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        mimeType: attachment.mimeType,
        size: attachment.size,
        ...(attachment.uri ? { uri: attachment.uri } : {}),
      })),
    } : {}),
  };
  await appendMessageLine(agentName, message);

  await queueMetaWrite(agentName, async () => {
    const meta = await readThreadMeta(agentName);
    if (!meta) return;
    const patch: Thread = {
      ...meta,
      updatedAt: message.timestamp,
    };
    // First user message doubles as auto-title.
    if ((meta.title === '(new thread)' || !meta.title) && message.role === 'user') {
      patch.title = message.content.trim().slice(0, 80) || '(new thread)';
    }
    await writeThreadMeta(patch);
  });

  return message;
}

async function setActiveSession(agentName: string, sessionKey: string): Promise<void> {
  await queueMetaWrite(agentName, async () => {
    const meta = await readThreadMeta(agentName);
    if (!meta) return;
    if (meta.activeSessionKey === sessionKey && meta.sessionChain.includes(sessionKey)) return;
    const chain = meta.sessionChain.includes(sessionKey)
      ? meta.sessionChain
      : [...meta.sessionChain, sessionKey];
    await writeThreadMeta({
      ...meta,
      activeSessionKey: sessionKey,
      sessionChain: chain,
      updatedAt: new Date().toISOString(),
    });
  });
}

// Returns the session the thread should use for the next message, creating a
// new one if:
//   • the thread has no active session yet, OR
//   • the active session is unhealthy (context > threshold or compacted).
//
// The caller is expected to spawn the OpenClaw CLI immediately after — the
// CLI picks its session by mtime, and createSession() touches a fresh jsonl
// so the new one wins.
export async function ensureActiveSession(agentName: string): Promise<{
  sessionKey: string;
  rolledOver: boolean;
  previousSessionKey: string | null;
}> {
  validateAgentName(agentName);
  const meta = await getOrCreateThread(agentName);

  const pickHealthyExisting = async (): Promise<SessionSummary | null> => {
    const sessions = await listSessions({ agentId: agentName, limit: 20 });
    if (!sessions.length) return null;
    const scored = sessions
      .filter((s) => s.compactionCount === 0)
      .filter((s) => {
        const pct = s.contextWindow > 0 ? s.usage.contextUsedTokens / s.contextWindow : 0;
        return pct < SESSION_ROLLOVER_THRESHOLD;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return scored[0] ?? null;
  };

  const current = meta.activeSessionKey
    ? await getSession(meta.activeSessionKey, { limit: 1 }).catch(() => null)
    : null;

  const isUnhealthy = (() => {
    if (!current) return true;
    if ((current.compactionCount ?? 0) > 0) return true;
    const pct = current.contextWindow > 0 ? current.usage.contextUsedTokens / current.contextWindow : 0;
    return pct >= SESSION_ROLLOVER_THRESHOLD;
  })();

  if (!isUnhealthy && meta.activeSessionKey) {
    return { sessionKey: meta.activeSessionKey, rolledOver: false, previousSessionKey: meta.activeSessionKey };
  }

  // Prefer adopting a healthy existing session before minting a brand new one —
  // avoids a sprawl of empty sessions when the mobile app reopens a thread.
  const reused = !current ? await pickHealthyExisting() : null;
  if (reused) {
    await setActiveSession(agentName, reused.key);
    return {
      sessionKey: reused.key,
      rolledOver: meta.activeSessionKey !== null && meta.activeSessionKey !== reused.key,
      previousSessionKey: meta.activeSessionKey,
    };
  }

  const created = await createSession(agentName);
  if (!created.ok || !created.session) {
    throw new Error(created.error ?? 'failed to create session');
  }
  await setActiveSession(agentName, created.session.key);
  return {
    sessionKey: created.session.key,
    rolledOver: meta.activeSessionKey !== null,
    previousSessionKey: meta.activeSessionKey,
  };
}

// Explicit rollover (used when the user taps "new session" / slash command).
export async function rolloverThread(agentName: string): Promise<{ sessionKey: string; previousSessionKey: string | null }> {
  validateAgentName(agentName);
  const meta = await getOrCreateThread(agentName);
  const created = await createSession(agentName);
  if (!created.ok || !created.session) {
    throw new Error(created.error ?? 'failed to create session');
  }
  await setActiveSession(agentName, created.session.key);
  return { sessionKey: created.session.key, previousSessionKey: meta.activeSessionKey };
}

// Resets the thread (forgets visible history). The underlying OpenClaw
// sessions are not deleted — they remain reachable via the advanced session
// picker.
export async function resetThread(agentName: string): Promise<void> {
  validateAgentName(agentName);
  const messagesPath = threadMessagesPath(agentName);
  try { await fsp.unlink(messagesPath); } catch { /* not present */ }
  await queueMetaWrite(agentName, async () => {
    const meta = await readThreadMeta(agentName);
    const now = new Date().toISOString();
    const next: Thread = meta
      ? { ...meta, title: '(new thread)', activeSessionKey: null, sessionChain: [], updatedAt: now }
      : {
          threadId: crypto.randomUUID(),
          agentName,
          title: '(new thread)',
          activeSessionKey: null,
          sessionChain: [],
          createdAt: now,
          updatedAt: now,
        };
    await writeThreadMeta(next);
  });
}

export async function deleteThread(agentName: string): Promise<void> {
  validateAgentName(agentName);
  try { await fsp.unlink(threadMessagesPath(agentName)); } catch { /* not present */ }
  try { await fsp.unlink(threadMetaPath(agentName)); } catch { /* not present */ }
}
