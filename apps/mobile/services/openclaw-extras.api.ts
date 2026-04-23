import { request } from './api';

// ── Delivery queue ──────────────────────────────────────────────────────────

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

export interface QueueListing {
  pending: DeliveryItem[];
  failed: DeliveryItem[];
  sent: DeliveryItem[];
  counts: Record<DeliveryStatus, number>;
}

export const deliveryQueueApi = {
  list: (status?: DeliveryStatus) =>
    request<{ data: QueueListing }>(`/api/openclaw/delivery-queue${status ? `?status=${status}` : ''}`)
      .then((r) => r.data),
  get: (id: string) =>
    request<{ data: DeliveryItem }>(`/api/openclaw/delivery-queue/${encodeURIComponent(id)}`).then((r) => r.data),
  retry: (id: string) =>
    request<{ data: DeliveryItem }>(`/api/openclaw/delivery-queue/${encodeURIComponent(id)}/retry`, { method: 'POST' }).then((r) => r.data),
  remove: (id: string) =>
    request<{ success: boolean }>(`/api/openclaw/delivery-queue/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// ── Approvals ───────────────────────────────────────────────────────────────

export interface AllowlistEntry {
  id: string;
  pattern: string;
  source: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

export interface ApprovalsConfig {
  version: number;
  defaults: { security: string; ask: string; askFallback: string };
  agents: Record<string, { allowlist: AllowlistEntry[] }>;
  hasSocket: boolean;
}

export interface PendingApproval {
  id: string;
  agent: string;
  command: string;
  resolvedPath?: string;
  pattern?: string;
  requestedAt: string;
  source: 'log' | 'socket';
  raw?: Record<string, unknown>;
  classification?: 'safe' | 'review' | 'dangerous';
  rationale?: string;
}

export const approvalsApi = {
  getConfig: () => request<{ data: ApprovalsConfig }>('/api/openclaw/approvals/config').then((r) => r.data),
  setDefaults: (patch: Partial<ApprovalsConfig['defaults']>) =>
    request<{ data: ApprovalsConfig['defaults'] }>('/api/openclaw/approvals/defaults', { method: 'PATCH', body: patch }).then((r) => r.data),
  listPending: () => request<{ data: PendingApproval[] }>('/api/openclaw/approvals/pending').then((r) => r.data),
  listAllowlist: (agent?: string) =>
    request<{ data: Record<string, AllowlistEntry[]> }>(`/api/openclaw/approvals/allowlist${agent ? `?agent=${encodeURIComponent(agent)}` : ''}`).then((r) => r.data),
  addEntry: (agent: string, pattern: string, source?: string) =>
    request<{ data: AllowlistEntry }>(`/api/openclaw/approvals/allowlist/${encodeURIComponent(agent)}`, {
      method: 'POST',
      body: { pattern, ...(source ? { source } : {}) },
    }).then((r) => r.data),
  removeEntry: (agent: string, id: string) =>
    request<{ success: boolean }>(`/api/openclaw/approvals/allowlist/${encodeURIComponent(agent)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  decide: (input: { agent: string; pattern: string; decision: 'approve' | 'reject' | 'allow-always'; notes?: string }) =>
    request<{ data: { ok: true; entry?: AllowlistEntry } }>('/api/openclaw/approvals/decide', { method: 'POST', body: input }).then((r) => r.data),
};

// ── Logs ────────────────────────────────────────────────────────────────────

export interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
  type: 'log' | 'jsonl' | 'json' | 'other';
}

export const logsApi = {
  list: () => request<{ data: LogFileInfo[] }>('/api/openclaw/logs').then((r) => r.data),
  tail: (name: string, bytes?: number) =>
    request<{ data: { content: string; size: number; offset: number } }>(
      `/api/openclaw/logs/${encodeURIComponent(name)}/tail${bytes ? `?bytes=${bytes}` : ''}`,
    ).then((r) => r.data),
  // Streaming helper provided separately via XHR if needed.
};

// ── Media ───────────────────────────────────────────────────────────────────

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

export const mediaApi = {
  list: (opts?: { source?: MediaSource; limit?: number; cursor?: string }) => {
    const qs: string[] = [];
    if (opts?.source) qs.push(`source=${opts.source}`);
    if (opts?.limit) qs.push(`limit=${opts.limit}`);
    if (opts?.cursor) qs.push(`cursor=${encodeURIComponent(opts.cursor)}`);
    return request<{ data: { items: MediaItem[]; nextCursor?: string } }>(
      `/api/openclaw/media${qs.length ? `?${qs.join('&')}` : ''}`,
    ).then((r) => r.data);
  },
  get: (id: string) =>
    request<{ data: MediaItem }>(`/api/openclaw/media/${id.split('/').map(encodeURIComponent).join('/')}`).then((r) => r.data),
};

// ── Budget ──────────────────────────────────────────────────────────────────

export interface BudgetStatus {
  daily: { spend: number; limit: number; pct: number; exceeded: boolean };
  monthly: { spend: number; limit: number; pct: number; exceeded: boolean };
  hardStop: boolean;
}

export const budgetApi = {
  status: () => request<{ data: BudgetStatus }>('/api/openclaw/usage/budget').then((r) => r.data),
};
