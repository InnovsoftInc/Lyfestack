import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { OPENCLAW_HOME } from './openclaw-json';

const QUEUE_ROOT = path.join(OPENCLAW_HOME, 'delivery-queue');
const FAILED_DIR = path.join(QUEUE_ROOT, 'failed');
const SENT_DIR = path.join(QUEUE_ROOT, 'sent');

export type DeliveryStatus = 'pending' | 'failed' | 'sent';

export interface DeliveryItem {
  id: string;
  filename: string;
  status: DeliveryStatus;
  size: number;
  createdAt: string;
  updatedAt: string;
  channel?: string;
  recipient?: string;
  subject?: string;
  attempts?: number;
  lastError?: string;
  body?: unknown;
}

function dirFor(status: DeliveryStatus): string {
  if (status === 'failed') return FAILED_DIR;
  if (status === 'sent') return SENT_DIR;
  return QUEUE_ROOT;
}

function pathFor(status: DeliveryStatus, filename: string): string {
  return path.join(dirFor(status), filename);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
}

function safeFilename(name: string): boolean {
  // Reject path traversal / hidden / non-json
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return false;
  return name.endsWith('.json');
}

async function readItem(status: DeliveryStatus, filename: string): Promise<DeliveryItem | null> {
  if (!safeFilename(filename)) return null;
  const fp = pathFor(status, filename);
  try {
    const stat = await fs.stat(fp);
    if (!stat.isFile()) return null;
    const raw = await fs.readFile(fp, 'utf-8').catch(() => '');
    let body: unknown = raw;
    try { body = JSON.parse(raw); } catch { /* keep raw string */ }
    const envelope = (body && typeof body === 'object' ? (body as Record<string, unknown>) : {}) ?? {};
    const item: DeliveryItem = {
      id: filename.replace(/\.json$/i, ''),
      filename,
      status,
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
    if (typeof envelope.channel === 'string') item.channel = envelope.channel;
    if (typeof envelope.recipient === 'string') item.recipient = envelope.recipient;
    if (typeof envelope.to === 'string' && !item.recipient) item.recipient = envelope.to;
    if (typeof envelope.subject === 'string') item.subject = envelope.subject;
    if (typeof envelope.attempts === 'number') item.attempts = envelope.attempts;
    if (typeof envelope.lastError === 'string') item.lastError = envelope.lastError;
    item.body = body;
    return item;
  } catch (err) {
    logger.debug({ filename, err: (err as Error).message }, 'delivery-queue: skipping unreadable item');
    return null;
  }
}

async function listDir(status: DeliveryStatus): Promise<DeliveryItem[]> {
  const dir = dirFor(status);
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); }
  catch { return []; }
  const items: DeliveryItem[] = [];
  for (const name of entries) {
    if (!safeFilename(name)) continue;
    const item = await readItem(status, name);
    if (item) items.push(item);
  }
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

export async function listQueue(status?: DeliveryStatus): Promise<{
  pending: DeliveryItem[];
  failed: DeliveryItem[];
  sent: DeliveryItem[];
  counts: Record<DeliveryStatus, number>;
}> {
  const wanted: DeliveryStatus[] = status ? [status] : ['pending', 'failed', 'sent'];
  const collected: Record<DeliveryStatus, DeliveryItem[]> = { pending: [], failed: [], sent: [] };
  for (const s of wanted) {
    collected[s] = await listDir(s);
  }
  return {
    pending: collected.pending,
    failed: collected.failed,
    sent: collected.sent,
    counts: {
      pending: collected.pending.length,
      failed: collected.failed.length,
      sent: collected.sent.length,
    },
  };
}

export async function getItem(id: string): Promise<DeliveryItem | null> {
  const filename = `${id}.json`;
  for (const status of ['pending', 'failed', 'sent'] as DeliveryStatus[]) {
    const item = await readItem(status, filename);
    if (item) return item;
  }
  return null;
}

export async function retryItem(id: string): Promise<DeliveryItem | null> {
  const filename = `${id}.json`;
  const failedPath = pathFor('failed', filename);
  const targetPath = pathFor('pending', filename);
  try {
    await fs.access(failedPath);
  } catch {
    return null;
  }
  await ensureDir(QUEUE_ROOT);
  await fs.rename(failedPath, targetPath);
  logger.info({ id }, 'delivery-queue: retry queued');
  return readItem('pending', filename);
}

export async function deleteItem(id: string): Promise<boolean> {
  const filename = `${id}.json`;
  let deleted = false;
  for (const status of ['pending', 'failed', 'sent'] as DeliveryStatus[]) {
    const fp = pathFor(status, filename);
    try {
      await fs.unlink(fp);
      logger.info({ id, status }, 'delivery-queue: deleted');
      deleted = true;
    } catch { /* not in this folder */ }
  }
  return deleted;
}
