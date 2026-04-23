import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger';

const OPENCLAW_AGENTS_DIR = path.join(process.env.HOME ?? '', '.openclaw', 'agents');

const UUID_JSONL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

export interface SessionSummary {
  key: string;
  agentId: string;
  sessionId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  index: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export interface SessionPage {
  key: string;
  messages: SessionMessage[];
  total: number;
  firstIndex: number;
  lastIndex: number;
}

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

export async function listSessions(limit = 20): Promise<SessionSummary[]> {
  const agents = await listAgentNames();
  const all = await Promise.all(
    agents.map(async (agentId) => {
      const files = await listSessionFilesForAgent(agentId);
      return Promise.all(
        files.map(async (f) => {
          const label = await readFirstUserMessage(f.filePath).catch(() => '');
          return {
            key: `${agentId}/${f.sessionId}`,
            agentId,
            sessionId: f.sessionId,
            label: label.slice(0, 80) || '(empty)',
            createdAt: f.mtime.toISOString(),
            updatedAt: f.mtime.toISOString(),
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
  if (!UUID_JSONL.test(`${sessionId}.jsonl`)) return null;
  return { agentId, sessionId };
}

export async function getSession(
  key: string,
  opts: { limit?: number; beforeIndex?: number; afterIndex?: number } = {},
): Promise<SessionPage | null> {
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

  try {
    for await (const line of rl) {
      if (!line) continue;
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry?.type !== 'message') continue;
      const role = entry.message?.role;
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

  return {
    key,
    messages: slice,
    total,
    firstIndex: slice[0]?.index ?? -1,
    lastIndex: slice[slice.length - 1]?.index ?? -1,
  };
}
