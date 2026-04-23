import * as fs from 'fs/promises';
import * as path from 'path';
import { OPENCLAW_HOME } from '../openclaw/openclaw-json';
import { logger } from '../../utils/logger';

const TOKENS_FILE = path.join(OPENCLAW_HOME, 'cache', 'push-tokens.json');

export interface PushTokenEntry {
  token: string;
  userId?: string;
  registeredAt: string;
  device?: string;
}

interface Store {
  tokens: PushTokenEntry[];
}

async function read(): Promise<Store> {
  try {
    const raw = await fs.readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(raw) as Store;
  } catch {
    return { tokens: [] };
  }
}

async function write(data: Store): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true });
  await fs.writeFile(TOKENS_FILE, JSON.stringify(data, null, 2));
}

export async function registerToken(entry: Omit<PushTokenEntry, 'registeredAt'>): Promise<void> {
  if (!entry.token) throw new Error('token required');
  const data = await read();
  const filtered = data.tokens.filter((t) => t.token !== entry.token);
  const next: PushTokenEntry = {
    token: entry.token,
    registeredAt: new Date().toISOString(),
  };
  if (entry.userId) next.userId = entry.userId;
  if (entry.device) next.device = entry.device;
  filtered.push(next);
  await write({ tokens: filtered });
  logger.info({ token: entry.token.slice(0, 18) + '…', userId: entry.userId }, 'push token registered');
}

export async function unregisterToken(token: string): Promise<boolean> {
  const data = await read();
  const before = data.tokens.length;
  data.tokens = data.tokens.filter((t) => t.token !== token);
  if (data.tokens.length === before) return false;
  await write(data);
  return true;
}

export async function listTokens(userId?: string): Promise<PushTokenEntry[]> {
  const data = await read();
  return userId ? data.tokens.filter((t) => t.userId === userId) : data.tokens;
}
