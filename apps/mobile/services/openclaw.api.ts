import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedBase: string | null = null;

async function getBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  const saved = await AsyncStorage.getItem('@lyfestack_api_base');
  cachedBase = saved ?? 'http://localhost:3000';
  return cachedBase;
}

export function resetApiBase() { cachedBase = null; }

async function request(path: string, options?: RequestInit) {
  const base = await getBase();
  const res = await fetch(`${base}/api/openclaw${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
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

  // Sessions
  listSessions: (limit = 20) => request(`/sessions?limit=${limit}`),
  getSession: (key: string) => request(`/sessions/detail?key=${encodeURIComponent(key)}`),
  createSession: (agentId: string, label?: string) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ agentId, label }),
    }),
};
