import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { OPENCLAW_HOME } from './openclaw-json';

const LOGS_DIR = path.join(OPENCLAW_HOME, 'logs');
const MAX_TAIL_BYTES = 256 * 1024;

export interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
  type: 'log' | 'jsonl' | 'json' | 'other';
}

function inferType(name: string): LogFileInfo['type'] {
  if (name.endsWith('.jsonl')) return 'jsonl';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.log') || /\.err$|\.out$/.test(name)) return 'log';
  return 'other';
}

function isSafeName(name: string): boolean {
  return !!name && !name.includes('/') && !name.includes('\\') && !name.startsWith('.');
}

export async function listLogs(): Promise<LogFileInfo[]> {
  let entries: string[] = [];
  try { entries = await fsp.readdir(LOGS_DIR); } catch { return []; }
  const out: LogFileInfo[] = [];
  for (const name of entries) {
    if (!isSafeName(name)) continue;
    const fp = path.join(LOGS_DIR, name);
    try {
      const stat = await fsp.stat(fp);
      if (!stat.isFile()) continue;
      out.push({
        name,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        type: inferType(name),
      });
    } catch { /* skip */ }
  }
  out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return out;
}

export async function tailLog(name: string, bytes = MAX_TAIL_BYTES): Promise<{ content: string; size: number; offset: number }> {
  if (!isSafeName(name)) throw new Error('invalid log name');
  const fp = path.join(LOGS_DIR, name);
  const stat = await fsp.stat(fp);
  const cap = Math.min(Math.max(bytes, 1024), MAX_TAIL_BYTES);
  const start = Math.max(0, stat.size - cap);
  const handle = await fsp.open(fp, 'r');
  try {
    const buf = Buffer.alloc(stat.size - start);
    await handle.read(buf, 0, buf.length, start);
    return { content: buf.toString('utf-8'), size: stat.size, offset: start };
  } finally {
    await handle.close();
  }
}

export interface LogStreamSubscription {
  close: () => void;
}

/**
 * Subscribe to live appends on a log file. The subscriber receives string
 * payloads as data is appended. The first emission is the latest tail (up to
 * the supplied bytes) so the consumer doesn't see a blank screen.
 */
export function streamLog(
  name: string,
  opts: { onData: (chunk: string) => void; onError: (err: Error) => void; tailBytes?: number },
): LogStreamSubscription {
  if (!isSafeName(name)) {
    opts.onError(new Error('invalid log name'));
    return { close: () => undefined };
  }
  const fp = path.join(LOGS_DIR, name);
  let offset = 0;
  let closed = false;
  let watcher: fs.FSWatcher | null = null;

  async function readFromOffset(): Promise<void> {
    if (closed) return;
    try {
      const stat = await fsp.stat(fp);
      if (stat.size <= offset) {
        // Truncation — reset.
        if (stat.size < offset) offset = 0;
        return;
      }
      const handle = await fsp.open(fp, 'r');
      try {
        const buf = Buffer.alloc(stat.size - offset);
        await handle.read(buf, 0, buf.length, offset);
        offset = stat.size;
        if (!closed) opts.onData(buf.toString('utf-8'));
      } finally {
        await handle.close();
      }
    } catch (err) {
      if (!closed) opts.onError(err as Error);
    }
  }

  (async () => {
    try {
      const stat = await fsp.stat(fp);
      const tailBytes = opts.tailBytes ?? 8 * 1024;
      const start = Math.max(0, stat.size - tailBytes);
      offset = start;
      await readFromOffset();
      watcher = fs.watch(fp, { persistent: false }, (eventType) => {
        if (closed) return;
        if (eventType === 'change' || eventType === 'rename') {
          void readFromOffset();
        }
      });
      watcher.on('error', (err) => { if (!closed) opts.onError(err); });
    } catch (err) {
      opts.onError(err as Error);
    }
  })();

  return {
    close: () => {
      closed = true;
      if (watcher) {
        try { watcher.close(); } catch { /* noop */ }
        watcher = null;
      }
      logger.debug({ name }, 'log stream closed');
    },
  };
}
