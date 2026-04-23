import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';
import { OPENCLAW_HOME } from '../openclaw/openclaw-json';
import { embed, embedBatch } from './embeddings.service';

const CACHE_DIR = path.join(OPENCLAW_HOME, 'cache');
const DB_PATH = path.join(CACHE_DIR, 'search.db');

export type SearchScope = 'sessions' | 'skills' | 'memory';

export interface SearchHit {
  id: string;
  scope: SearchScope;
  source: string;
  snippet: string;
  score: number;
}

interface DocRow {
  id: string;
  scope: SearchScope;
  source: string;
  body: string;
  vector: Buffer;
  mtime: number;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => undefined);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      source TEXT NOT NULL,
      body TEXT NOT NULL,
      vector BLOB NOT NULL,
      mtime INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS docs_scope ON docs(scope);
    CREATE INDEX IF NOT EXISTS docs_mtime ON docs(mtime);
  `);
  return db;
}

function vecToBuffer(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

function bufferToVec(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function cosine(a: Float32Array, b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface DiscoveredDoc {
  id: string;
  scope: SearchScope;
  source: string;
  body: string;
  mtime: number;
}

async function* walk(dir: string): AsyncGenerator<{ path: string; stat: import('fs').Stats }> {
  let entries: import('fs').Dirent[] = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(full);
    else if (ent.isFile()) {
      try { const stat = await fs.stat(full); yield { path: full, stat }; } catch { /* skip */ }
    }
  }
}

async function discoverSessions(): Promise<DiscoveredDoc[]> {
  const root = path.join(OPENCLAW_HOME, 'agents');
  const docs: DiscoveredDoc[] = [];
  for await (const file of walk(root)) {
    if (!file.path.endsWith('.jsonl')) continue;
    if (!file.path.includes('/sessions/')) continue;
    try {
      const raw = await fs.readFile(file.path, 'utf-8');
      const lines = raw.split('\n').filter(Boolean);
      const parts: string[] = [];
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const text = typeof obj.content === 'string'
            ? obj.content
            : typeof obj.text === 'string' ? obj.text : '';
          if (text) parts.push(`[${obj.role ?? '?'}] ${text}`);
        } catch { /* skip */ }
      }
      if (!parts.length) continue;
      const rel = path.relative(root, file.path);
      docs.push({
        id: `sessions:${rel}`,
        scope: 'sessions',
        source: rel,
        body: parts.join('\n').slice(0, 6000),
        mtime: file.stat.mtimeMs,
      });
    } catch { /* skip */ }
  }
  return docs;
}

async function discoverDirAsMarkdown(scope: SearchScope, root: string): Promise<DiscoveredDoc[]> {
  const docs: DiscoveredDoc[] = [];
  for await (const file of walk(root)) {
    if (!/\.(md|txt)$/i.test(file.path)) continue;
    try {
      const body = await fs.readFile(file.path, 'utf-8');
      if (!body.trim()) continue;
      const rel = path.relative(root, file.path);
      docs.push({
        id: `${scope}:${rel}`,
        scope,
        source: rel,
        body: body.slice(0, 6000),
        mtime: file.stat.mtimeMs,
      });
    } catch { /* skip */ }
  }
  return docs;
}

export interface ReindexStats {
  added: number;
  updated: number;
  removed: number;
  total: number;
  skipped: number;
}

export async function reindex(scopes: SearchScope[] = ['sessions', 'skills', 'memory']): Promise<ReindexStats> {
  const conn = getDb();
  const discovered: DiscoveredDoc[] = [];
  if (scopes.includes('sessions')) discovered.push(...(await discoverSessions()));
  if (scopes.includes('skills')) discovered.push(...(await discoverDirAsMarkdown('skills', path.join(OPENCLAW_HOME, 'skills'))));
  if (scopes.includes('memory')) discovered.push(...(await discoverDirAsMarkdown('memory', path.join(OPENCLAW_HOME, 'memory'))));

  const existing = conn.prepare<[], { id: string; mtime: number }>('SELECT id, mtime FROM docs').all();
  const existingMap = new Map(existing.map((e) => [e.id, e.mtime]));
  const seen = new Set<string>();
  const toEmbed: DiscoveredDoc[] = [];
  let skipped = 0;
  for (const doc of discovered) {
    seen.add(doc.id);
    const old = existingMap.get(doc.id);
    if (old !== undefined && Math.abs(old - doc.mtime) < 1) { skipped += 1; continue; }
    toEmbed.push(doc);
  }

  let added = 0, updated = 0;
  if (toEmbed.length) {
    const { vectors } = await embedBatch(toEmbed.map((d) => d.body));
    const insert = conn.prepare(
      'INSERT OR REPLACE INTO docs (id, scope, source, body, vector, mtime) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const txn = conn.transaction((rows: Array<DocRow>) => {
      for (const r of rows) insert.run(r.id, r.scope, r.source, r.body, r.vector, r.mtime);
    });
    const rows: DocRow[] = toEmbed.map((d, i) => ({
      id: d.id,
      scope: d.scope,
      source: d.source,
      body: d.body,
      vector: vecToBuffer(vectors[i] ?? []),
      mtime: Math.floor(d.mtime),
    }));
    txn(rows);
    for (const d of toEmbed) {
      if (existingMap.has(d.id)) updated += 1; else added += 1;
    }
  }

  // Drop docs whose source files vanished, but only within the scopes we just scanned.
  let removed = 0;
  const scopePlaceholders = scopes.map(() => '?').join(',');
  const stale = conn.prepare<string[], { id: string }>(
    `SELECT id FROM docs WHERE scope IN (${scopePlaceholders})`,
  ).all(...scopes);
  const del = conn.prepare('DELETE FROM docs WHERE id = ?');
  const delTxn = conn.transaction((ids: string[]) => { for (const id of ids) del.run(id); });
  const toDelete = stale.filter((s) => !seen.has(s.id)).map((s) => s.id);
  if (toDelete.length) { delTxn(toDelete); removed = toDelete.length; }

  const total = (conn.prepare<[], { c: number }>('SELECT COUNT(*) as c FROM docs').get())?.c ?? 0;
  logger.info({ added, updated, removed, total, skipped }, 'search index rebuilt');
  return { added, updated, removed, total, skipped };
}

export interface SearchOptions {
  q: string;
  scopes?: SearchScope[];
  limit?: number;
}

export async function search(opts: SearchOptions): Promise<SearchHit[]> {
  const conn = getDb();
  const { vector } = await embed(opts.q);
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 30);
  const where = opts.scopes && opts.scopes.length
    ? `WHERE scope IN (${opts.scopes.map(() => '?').join(',')})`
    : '';
  const rows = conn.prepare<string[], { id: string; scope: SearchScope; source: string; body: string; vector: Buffer }>(
    `SELECT id, scope, source, body, vector FROM docs ${where}`,
  ).all(...(opts.scopes ?? []));

  const scored = rows.map((row) => {
    const vec = bufferToVec(row.vector);
    return {
      id: row.id,
      scope: row.scope,
      source: row.source,
      snippet: row.body.slice(0, 240).replace(/\s+/g, ' '),
      score: cosine(vec, vector),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function getIndexStats(): { total: number; byScope: Record<string, number> } {
  const conn = getDb();
  const total = (conn.prepare<[], { c: number }>('SELECT COUNT(*) as c FROM docs').get())?.c ?? 0;
  const rows = conn.prepare<[], { scope: string; c: number }>(
    'SELECT scope, COUNT(*) as c FROM docs GROUP BY scope',
  ).all();
  const byScope: Record<string, number> = {};
  for (const r of rows) byScope[r.scope] = r.c;
  return { total, byScope };
}
