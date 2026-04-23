import AsyncStorage from '@react-native-async-storage/async-storage';
import { request as authedRequest, getAuthToken } from './api';

let cachedBase: string | null = null;

async function getBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  const envUrl = process.env['EXPO_PUBLIC_API_URL'];
  if (envUrl) {
    cachedBase = envUrl;
    return cachedBase;
  }
  const saved = await AsyncStorage.getItem('@lyfestack_api_base');
  cachedBase = saved ?? 'http://localhost:3000';
  return cachedBase;
}

export function setBase(url: string) { cachedBase = url; }
export function resetApiBase() { cachedBase = null; }

const COMMON_PORTS = [3000, 8080, 4000];
const SUBNETS = ['192.168.1', '192.168.0', '10.0.0', '10.0.1'];
const COMMON_HOSTS = [1, 2, 10, 50, 100, 142, 200];

export async function tryConnect(): Promise<string | null> {
  const envUrl = process.env['EXPO_PUBLIC_API_URL'];
  if (envUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${envUrl}/api/openclaw/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) { cachedBase = envUrl; return envUrl; }
    } catch { /* env URL unreachable */ }
  }

  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem('@lyfestack_api_base');
  } catch { /* AsyncStorage unavailable — skip saved path */ }

  if (saved) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${saved}/api/openclaw/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) { cachedBase = saved; return saved; }
    } catch { /* saved URL unreachable */ }
  }
  return null;
}

export async function autoDiscover(): Promise<string | null> {
  // Try saved first
  const fast = await tryConnect();
  if (fast) return fast;

  // Scan local network
  const checks: Promise<string | null>[] = [];
  for (const subnet of SUBNETS) {
    for (const host of COMMON_HOSTS) {
      for (const port of COMMON_PORTS) {
        const url = `http://${subnet}.${host}:${port}`;
        checks.push(
          (async () => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 2000);
              const res = await fetch(`${url}/api/openclaw/status`, { signal: controller.signal });
              clearTimeout(timeout);
              if (res.ok) return url;
            } catch { /* next */ }
            return null;
          })()
        );
      }
    }
  }

  // Run all scans in parallel (much faster than sequential)
  const results = await Promise.all(checks);
  const found = results.find((r) => r !== null);
  if (found) {
    cachedBase = found;
    try { await AsyncStorage.setItem('@lyfestack_api_base', found); } catch { /* best-effort */ }
    return found;
  }
  return null;
}

async function request(path: string, options?: RequestInit): Promise<unknown> {
  const body = options?.body;
  return authedRequest<unknown>(`/api/openclaw${path}`, {
    ...(options?.method && { method: options.method }),
    ...(body !== undefined && body !== null && { body }),
    ...(options?.headers && { headers: options.headers as Record<string, string> }),
  });
}

// Map raw tool names to human-readable labels
function formatToolLabel(name: string): string {
  if (!name) return '';
  const lower = name.toLowerCase();
  const map: Record<string, string> = {
    'read': 'Reading file',
    'write': 'Writing file',
    'edit': 'Editing file',
    'bash': 'Running command',
    'grep': 'Searching code',
    'glob': 'Finding files',
    'webfetch': 'Fetching web page',
    'websearch': 'Searching the web',
    'web_search': 'Searching the web',
    'web_fetch': 'Fetching web page',
    'list_directory': 'Listing directory',
    'execute_code': 'Running code',
    'python': 'Running Python',
    'node': 'Running Node.js',
    'create_file': 'Creating file',
    'delete_file': 'Deleting file',
    'move_file': 'Moving file',
    'search': 'Searching',
    'browser': 'Using browser',
    'screenshot': 'Taking screenshot',
  };
  // Check exact match first
  if (map[lower]) return map[lower];
  // Check partial match
  for (const [key, label] of Object.entries(map)) {
    if (lower.includes(key)) return label;
  }
  // Fallback: humanize the name (snake_case / camelCase → words)
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (response: string) => void;
  onError: (err: Error) => void;
  onToolActivity?: (tool: string | null) => void;
  onInit?: (info: { messageId: string; resumed: boolean }) => void;
  onCursor?: (cursor: number) => void;
}

export interface StreamOptions extends StreamCallbacks {
  messageId?: string;
  signal?: AbortSignal;
}

export async function streamAgentMessage(
  agentId: string,
  message: string,
  opts: StreamOptions,
): Promise<void> {
  const { signal, messageId, onChunk, onDone, onError, onToolActivity, onInit, onCursor } = opts;
  if (signal?.aborted) return;

  try {
    const base = await getBase();
    const token = await getAuthToken();
    const url = `${base}/api/openclaw/agents/${encodeURIComponent(agentId)}/message/stream`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let processedLength = 0;
      let lineBuffer = '';
      let firstChunkReceived = false;
      let accumulatedResponse = '';

      // Show "using tools..." if no text arrives within 3 s
      let toolTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        toolTimer = null;
        if (!firstChunkReceived) onToolActivity?.('using tools...');
      }, 3000);

      function clearToolTimer() {
        if (toolTimer) { clearTimeout(toolTimer); toolTimer = null; }
      }

      function clearCurrentTool() {
        onToolActivity?.('__done_current__');
      }

      function processLines() {
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              clearToolTimer();
              safeReject(new Error(payload.error));
              return;
            }
            if (payload.type === 'init') {
              onInit?.({ messageId: payload.messageId, resumed: Boolean(payload.resumed) });
              continue;
            }
            if (payload.type === 'tool_use') {
              // Build a descriptive label from the tool name
              const rawName: string = payload.name ?? payload.tool ?? '';
              const label = formatToolLabel(rawName);
              if (label) onToolActivity?.(label);
            } else if (payload.type === 'tool_result') {
              clearCurrentTool();
            } else if (payload.chunk !== undefined) {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                clearToolTimer();
                // Mark current tool as done but DON'T clear history
                clearCurrentTool();
              }
              accumulatedResponse += payload.chunk;
              onChunk(payload.chunk);
              if (typeof payload.cursor === 'number') onCursor?.(payload.cursor);
            } else if (payload.done) {
              clearToolTimer();
              clearCurrentTool();
              onDone(payload.response ?? accumulatedResponse);
              safeResolve();
            }
          } catch { /* malformed JSON line — skip */ }
        }
      }

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        lineBuffer += newText;
        processLines();
      };

      let resolved = false;
      const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };
      const safeReject = (e: Error) => { if (!resolved) { resolved = true; reject(e); } };

      xhr.onload = () => {
        clearToolTimer();
        if (xhr.status >= 400) {
          safeReject(new Error(`OpenClaw API error: ${xhr.status}`));
          return;
        }
        if (lineBuffer.trim()) {
          lineBuffer += '\n';
          processLines();
        }
        // If onDone was never called (no "done" SSE event), finalize with accumulated chunks
        if (!resolved) {
          clearCurrentTool();
          onDone(accumulatedResponse);
          safeResolve();
        }
      };

      xhr.onerror = () => { clearToolTimer(); clearCurrentTool(); safeReject(new Error('Network request failed')); };
      xhr.ontimeout = () => { clearToolTimer(); clearCurrentTool(); safeReject(new Error('Request timed out')); };

      if (signal) {
        signal.addEventListener('abort', () => {
          clearToolTimer();
          clearCurrentTool();
          xhr.abort();
          safeResolve();
        });
      }

      xhr.send(JSON.stringify({ message, ...(messageId ? { messageId } : {}) }));
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) return;
    onError(err instanceof Error ? err : new Error(err?.message ?? 'stream failed'));
  }
}

export interface ResumeOptions extends StreamCallbacks {
  signal?: AbortSignal;
}

export class StreamEvictedError extends Error {
  constructor(public messageId: string) {
    super(`Stream ${messageId} has been evicted`);
    this.name = 'StreamEvictedError';
  }
}

export async function resumeAgentStream(
  agentId: string,
  messageId: string,
  cursor: number,
  opts: ResumeOptions,
): Promise<void> {
  const { signal, onChunk, onDone, onError, onToolActivity, onInit, onCursor } = opts;
  if (signal?.aborted) return;

  try {
    const base = await getBase();
    const token = await getAuthToken();
    const url = `${base}/api/openclaw/agents/${encodeURIComponent(agentId)}/message/stream/resume?messageId=${encodeURIComponent(messageId)}&cursor=${cursor}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let processedLength = 0;
      let lineBuffer = '';
      let accumulatedResponse = '';
      let resolved = false;
      const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };
      const safeReject = (e: Error) => { if (!resolved) { resolved = true; reject(e); } };

      function clearCurrentTool() {
        onToolActivity?.('__done_current__');
      }

      function processLines() {
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              safeReject(new Error(payload.error));
              return;
            }
            if (payload.type === 'init') {
              onInit?.({ messageId: payload.messageId, resumed: true });
              continue;
            }
            if (payload.type === 'tool_use') {
              const rawName: string = payload.name ?? payload.tool ?? '';
              const label = formatToolLabel(rawName);
              if (label) onToolActivity?.(label);
            } else if (payload.type === 'tool_result') {
              clearCurrentTool();
            } else if (payload.chunk !== undefined) {
              accumulatedResponse += payload.chunk;
              onChunk(payload.chunk);
              if (typeof payload.cursor === 'number') onCursor?.(payload.cursor);
            } else if (payload.done) {
              clearCurrentTool();
              onDone(payload.response ?? accumulatedResponse);
              safeResolve();
            }
          } catch { /* malformed JSON line — skip */ }
        }
      }

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        lineBuffer += newText;
        processLines();
      };
      xhr.onload = () => {
        if (xhr.status === 410) {
          safeReject(new StreamEvictedError(messageId));
          return;
        }
        if (xhr.status >= 400) {
          safeReject(new Error(`Resume failed: ${xhr.status}`));
          return;
        }
        if (lineBuffer.trim()) { lineBuffer += '\n'; processLines(); }
        clearCurrentTool();
        safeResolve();
      };
      xhr.onerror = () => { clearCurrentTool(); safeReject(new Error('Network request failed')); };
      xhr.ontimeout = () => { clearCurrentTool(); safeReject(new Error('Request timed out')); };

      if (signal) {
        signal.addEventListener('abort', () => {
          clearCurrentTool();
          xhr.abort();
          safeResolve();
        });
      }

      xhr.send();
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) return;
    onError(err instanceof Error ? err : new Error(err?.message ?? 'resume failed'));
  }
}

export interface StreamStatus {
  messageId: string;
  agentId: string;
  sessionId?: string;
  cursor: number;
  done: boolean;
  error?: string;
}

export async function getStreamStatus(messageId: string): Promise<StreamStatus | null> {
  try {
    const res = await authedRequest<{ data: StreamStatus }>(
      `/api/openclaw/streams/${encodeURIComponent(messageId)}/status`,
    );
    return res.data;
  } catch (err: any) {
    if (err?.message?.includes('410') || err?.message?.toLowerCase?.().includes('evicted')) {
      return null;
    }
    throw err;
  }
}

export const openclawApi = {
  getStatus: () => request('/status'),
  listAgents: () => request('/agents'),
  createAgent: (config: { name: string; model?: string }) =>
    request('/agents', { method: 'POST', body: JSON.stringify(config) }),
  deleteAgent: (name: string) => request(`/agents/${name}`, { method: 'DELETE' }),
  sendMessage: (agentId: string, message: string) =>
    request(`/agents/${encodeURIComponent(agentId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getAgent: (name: string) => request(`/agents/${encodeURIComponent(name)}`),
  updateAgent: (name: string, updates: { role?: string; model?: string; systemPrompt?: string; persona?: Record<string, unknown> }) =>
    request(`/agents/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(updates) }),
  renameAgent: (name: string, newName: string) =>
    request(`/agents/${encodeURIComponent(name)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ newName }),
    }),
  listAgentFiles: (name: string) => request(`/agents/${encodeURIComponent(name)}/files`),
  getAgentFile: (name: string, filename: string) =>
    request(`/agents/${encodeURIComponent(name)}/files/${encodeURIComponent(filename)}`),
  updateAgentFile: (name: string, filename: string, content: string) =>
    request(`/agents/${encodeURIComponent(name)}/files/${encodeURIComponent(filename)}`, {
      method: 'PUT', body: JSON.stringify({ content }),
    }),

  getConfig: () => request('/config'),
  updateConfig: (updates: {
    agentDefaults?: { primaryModel?: string; fallbackModels?: string[] };
    codingTool?: string;
  }) => request('/config', { method: 'PATCH', body: JSON.stringify(updates) }),
  getAuthProfiles: () => request('/auth-profiles'),
  updateAuthProfile: (name: string, key: string) =>
    request(`/auth-profiles/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify({ key }),
    }),

  // Sessions
  listSessions: (opts?: { agentId?: string; limit?: number }) => {
    const qs: string[] = [];
    qs.push(`limit=${opts?.limit ?? 20}`);
    if (opts?.agentId) qs.push(`agentId=${encodeURIComponent(opts.agentId)}`);
    return request(`/sessions?${qs.join('&')}`);
  },
  getSession: (key: string, opts?: { limit?: number; beforeIndex?: number; afterIndex?: number }) => {
    const qs = [`key=${encodeURIComponent(key)}`];
    if (opts?.limit !== undefined) qs.push(`limit=${opts.limit}`);
    if (opts?.beforeIndex !== undefined) qs.push(`beforeIndex=${opts.beforeIndex}`);
    if (opts?.afterIndex !== undefined) qs.push(`afterIndex=${opts.afterIndex}`);
    return request(`/sessions/detail?${qs.join('&')}`);
  },
  createSession: (agentId: string) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }),
  deleteSession: (agentId: string, sessionId: string) =>
    request(`/sessions/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),

  // Usage tracking
  getUsage: () => request('/usage'),
  getUsageHistory: (limit: number = 100) => request(`/usage/history?limit=${limit}`),
  getUsageByAgent: () => request('/usage/by-agent'),
  getUsageByModel: () => request('/usage/by-model'),

  // Skills
  listSkills: () => request('/skills'),
  getSkill: (name: string) => request(`/skills/${encodeURIComponent(name)}`),
  createSkill: (name: string, content: string) =>
    request('/skills', { method: 'POST', body: JSON.stringify({ name, content }) }),
  updateSkill: (name: string, content: string) =>
    request(`/skills/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteSkill: (name: string) =>
    request(`/skills/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // Automations / Routines
  listAutomations: () => request('/automations'),
  createAutomation: (data: {
    name: string;
    schedule: string;
    agent: string;
    prompt: string;
    enabled?: boolean;
    notify?: { channel: string };
  }) => request('/automations', { method: 'POST', body: JSON.stringify(data) }),
  deleteAutomation: (id: string) => request(`/automations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggleAutomation: (id: string, enabled: boolean) =>
    request(`/automations/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  runAutomationNow: (id: string) =>
    request(`/automations/${encodeURIComponent(id)}/run`, { method: 'POST' }),
  getAutomationHistory: (id: string) =>
    request(`/automations/${encodeURIComponent(id)}/history`),
};
