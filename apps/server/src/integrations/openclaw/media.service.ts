import * as fs from 'fs/promises';
import * as path from 'path';
import { OPENCLAW_HOME } from './openclaw-json';

const MEDIA_DIR = path.join(OPENCLAW_HOME, 'media');
const CANVAS_FILE = path.join(OPENCLAW_HOME, 'canvas', 'index.html');

export type MediaSource = 'browser' | 'inbound' | 'other';

export interface MediaItem {
  id: string;
  source: MediaSource;
  filename: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  url: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

function inferMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function safeLeaf(name: string): boolean {
  return !!name && !name.includes('/') && !name.includes('\\') && !name.startsWith('..');
}

function sourceFromDir(dir: string): MediaSource {
  if (dir === 'browser') return 'browser';
  if (dir === 'inbound') return 'inbound';
  return 'other';
}

async function readDir(source: MediaSource, sub: string): Promise<MediaItem[]> {
  const dir = path.join(MEDIA_DIR, sub);
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); } catch { return []; }
  const items: MediaItem[] = [];
  for (const name of entries) {
    if (!safeLeaf(name)) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      items.push({
        id: `${sub}/${name}`,
        source,
        filename: name,
        mimeType: inferMime(name),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        url: `/api/openclaw/media/file/${encodeURIComponent(sub)}/${encodeURIComponent(name)}`,
      });
    } catch { /* skip */ }
  }
  return items;
}

export interface ListMediaOptions {
  source?: MediaSource;
  limit?: number;
  cursor?: string;
}

export async function listMedia(opts: ListMediaOptions = {}): Promise<{ items: MediaItem[]; nextCursor?: string }> {
  const sources: Array<{ sub: string; source: MediaSource }> = [];
  if (!opts.source || opts.source === 'browser') sources.push({ sub: 'browser', source: 'browser' });
  if (!opts.source || opts.source === 'inbound') sources.push({ sub: 'inbound', source: 'inbound' });
  if (!opts.source || opts.source === 'other') {
    // Scan top-level files in media/ that aren't in a known subdir.
    try {
      const top = await fs.readdir(MEDIA_DIR);
      for (const name of top) {
        if (name === 'browser' || name === 'inbound') continue;
        if (!safeLeaf(name)) continue;
        const full = path.join(MEDIA_DIR, name);
        try {
          const stat = await fs.stat(full);
          if (stat.isFile()) sources.push({ sub: '.', source: 'other' });
        } catch { /* skip */ }
        break;
      }
    } catch { /* media dir missing */ }
  }

  let all: MediaItem[] = [];
  for (const s of sources) {
    const list = await readDir(s.source, s.sub);
    all = all.concat(list);
  }
  all.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 500);
  const cursorIndex = opts.cursor ? all.findIndex((it) => it.id === opts.cursor) : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const slice = all.slice(startIndex, startIndex + limit);
  const nextCursor = startIndex + limit < all.length ? slice[slice.length - 1]?.id : undefined;

  return nextCursor ? { items: slice, nextCursor } : { items: slice };
}

export async function getMediaPath(sub: string, filename: string): Promise<string | null> {
  if (!safeLeaf(filename)) return null;
  if (!safeLeaf(sub) && sub !== '.') return null;
  const fp = path.join(MEDIA_DIR, sub, filename);
  // Path-traversal guard: ensure we stay inside MEDIA_DIR.
  const resolved = path.resolve(fp);
  if (!resolved.startsWith(path.resolve(MEDIA_DIR) + path.sep) && resolved !== path.resolve(MEDIA_DIR)) {
    return null;
  }
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return null;
    return resolved;
  } catch { return null; }
}

export async function getMediaItem(id: string): Promise<MediaItem | null> {
  const [sub, ...rest] = id.split('/');
  if (!sub || !rest.length) return null;
  const filename = rest.join('/');
  const fp = await getMediaPath(sub, filename);
  if (!fp) return null;
  const stat = await fs.stat(fp);
  return {
    id,
    source: sourceFromDir(sub),
    filename,
    mimeType: inferMime(filename),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    url: `/api/openclaw/media/file/${encodeURIComponent(sub)}/${encodeURIComponent(filename)}`,
  };
}

export async function readCanvas(): Promise<string | null> {
  try {
    return await fs.readFile(CANVAS_FILE, 'utf-8');
  } catch { return null; }
}
