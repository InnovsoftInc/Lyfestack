import { logger } from '../../utils/logger';

export type LyfeStackDeliveryEvent = {
  deliveryKey: string;
  channel: string;
  target: string;
  text: string;
  threadId?: string | number | null | undefined;
  replyToId?: string | null | undefined;
  accountId?: string | null | undefined;
  payload?: unknown;
  createdAt?: string | undefined;
};

export type LyfeStackMessageRecord = LyfeStackDeliveryEvent & {
  messageId: string;
  createdAt: string;
  updatedAt: string;
};

type Subscriber = (event: LyfeStackMessageRecord) => void;

const messages = new Map<string, LyfeStackMessageRecord>();
const subscribers = new Set<Subscriber>();

function nowIso(): string {
  return new Date().toISOString();
}

export function upsertLyfeStackEvent(event: LyfeStackDeliveryEvent): LyfeStackMessageRecord {
  const existing = messages.get(event.deliveryKey);
  const next: LyfeStackMessageRecord = {
    ...event,
    messageId: existing?.messageId ?? event.deliveryKey,
    createdAt: existing?.createdAt ?? event.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  messages.set(event.deliveryKey, next);
  for (const sub of subscribers) {
    try { sub(next); } catch (err) { logger.warn({ err }, 'lyfestack subscriber threw'); }
  }
  return next;
}

export function listLyfeStackEvents(limit = 100): LyfeStackMessageRecord[] {
  return [...messages.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, limit));
}

export function subscribeLyfeStackEvents(sub: Subscriber): () => void {
  subscribers.add(sub);
  return () => { subscribers.delete(sub); };
}
