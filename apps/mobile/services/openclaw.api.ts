import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from './api';

let cachedBase: string | null = null;

async function getBase(): Promise<string> {
  if (cachedBase) return cachedBase;
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

async function request(path: string, options?: RequestInit) {
  const base = await getBase();
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${base}/api/openclaw${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`OpenClaw API error: ${res.status}`);
  return res.json();
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
  listSessions: (limit: number = 20) => request(`/sessions?limit=${limit}`),
  getSession: (key: string) => request(`/sessions/detail?key=${encodeURIComponent(key)}`),
  createSession: (agentId: string, label?: string) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId, label }),
    }),

  // Usage tracking
  getUsage: () => request('/usage'),
  getUsageHistory: (limit: number = 100) => request(`/usage/history?limit=${limit}`),
  getUsageByAgent: () => request('/usage/by-agent'),
  getUsageByModel: () => request('/usage/by-model'),

  // Automations
  listAutomations: () => request('/automations'),
  createAutomation: (data: {
    name: string;
    agentName: string;
    cronExpression: string;
    scheduleLabel: string;
    message: string;
    enabled: boolean;
  }) => request('/automations', { method: 'POST', body: JSON.stringify(data) }),
  deleteAutomation: (id: string) => request(`/automations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggleAutomation: (id: string, enabled: boolean) =>
    request(`/automations/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  runAutomationNow: (id: string) =>
    request(`/automations/${encodeURIComponent(id)}/run`, { method: 'POST' }),
};
