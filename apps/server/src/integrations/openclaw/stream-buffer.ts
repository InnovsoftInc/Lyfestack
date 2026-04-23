import { logger } from '../../utils/logger';

const TTL_MS = 10 * 60 * 1000;
const MAX_BUFFERS = 100;

export type StreamEvent =
  | { type: 'chunk'; chunk: string; cursor: number }
  | { type: 'done'; response: string }
  | { type: 'error'; message: string }
  | { type: 'tool'; payload: Record<string, unknown> };

type Subscriber = (event: StreamEvent) => void;

export interface BufferedStream {
  messageId: string;
  agentId: string;
  sessionId?: string;
  chunks: string[];
  events: StreamEvent[];
  done: boolean;
  response?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  subscribers: Set<Subscriber>;
}

const buffers = new Map<string, BufferedStream>();

function evictExpired() {
  const now = Date.now();
  for (const [id, buf] of buffers) {
    if (now - buf.updatedAt > TTL_MS) {
      buffers.delete(id);
    }
  }
  if (buffers.size > MAX_BUFFERS) {
    const sorted = [...buffers.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const toDelete = sorted.slice(0, buffers.size - MAX_BUFFERS);
    for (const [id] of toDelete) buffers.delete(id);
  }
}

setInterval(evictExpired, 60_000).unref?.();

export function createBuffer(messageId: string, agentId: string, sessionId?: string): BufferedStream {
  evictExpired();
  const buf: BufferedStream = {
    messageId,
    agentId,
    ...(sessionId ? { sessionId } : {}),
    chunks: [],
    events: [],
    done: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    subscribers: new Set(),
  };
  buffers.set(messageId, buf);
  logger.debug({ messageId, agentId }, 'stream-buffer created');
  return buf;
}

export function getBuffer(messageId: string): BufferedStream | undefined {
  return buffers.get(messageId);
}

export function appendChunk(messageId: string, chunk: string): number {
  const buf = buffers.get(messageId);
  if (!buf) return -1;
  buf.chunks.push(chunk);
  buf.updatedAt = Date.now();
  const cursor = buf.chunks.length;
  const event: StreamEvent = { type: 'chunk', chunk, cursor };
  buf.events.push(event);
  for (const sub of buf.subscribers) {
    try { sub(event); } catch (err) { logger.warn({ err }, 'subscriber threw'); }
  }
  return cursor;
}

export function appendToolEvent(messageId: string, payload: Record<string, unknown>): void {
  const buf = buffers.get(messageId);
  if (!buf) return;
  buf.updatedAt = Date.now();
  const event: StreamEvent = { type: 'tool', payload };
  buf.events.push(event);
  for (const sub of buf.subscribers) {
    try { sub(event); } catch (err) { logger.warn({ err }, 'subscriber threw'); }
  }
}

export function markDone(messageId: string, response: string): void {
  const buf = buffers.get(messageId);
  if (!buf) return;
  buf.done = true;
  buf.response = response;
  buf.updatedAt = Date.now();
  const event: StreamEvent = { type: 'done', response };
  buf.events.push(event);
  for (const sub of buf.subscribers) {
    try { sub(event); } catch (err) { logger.warn({ err }, 'subscriber threw'); }
  }
  buf.subscribers.clear();
}

export function markError(messageId: string, message: string): void {
  const buf = buffers.get(messageId);
  if (!buf) return;
  buf.done = true;
  buf.error = message;
  buf.updatedAt = Date.now();
  const event: StreamEvent = { type: 'error', message };
  buf.events.push(event);
  for (const sub of buf.subscribers) {
    try { sub(event); } catch (err) { logger.warn({ err }, 'subscriber threw'); }
  }
  buf.subscribers.clear();
}

export function subscribe(messageId: string, sub: Subscriber): () => void {
  const buf = buffers.get(messageId);
  if (!buf) return () => undefined;
  buf.subscribers.add(sub);
  return () => buf.subscribers.delete(sub);
}

export interface ResumeReplay {
  buffer: BufferedStream;
  missedChunks: Array<{ chunk: string; cursor: number }>;
  finalEvent?: StreamEvent;
}

export function buildResume(messageId: string, fromCursor: number): ResumeReplay | null {
  const buf = buffers.get(messageId);
  if (!buf) return null;
  buf.updatedAt = Date.now();
  const missed: Array<{ chunk: string; cursor: number }> = [];
  for (let i = Math.max(0, fromCursor); i < buf.chunks.length; i++) {
    missed.push({ chunk: buf.chunks[i] as string, cursor: i + 1 });
  }
  const replay: ResumeReplay = { buffer: buf, missedChunks: missed };
  if (buf.done) {
    replay.finalEvent = buf.error
      ? { type: 'error', message: buf.error }
      : { type: 'done', response: buf.response ?? '' };
  }
  return replay;
}
