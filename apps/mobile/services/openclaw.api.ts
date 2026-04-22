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
  if (\!res.ok) throw new Error(`OpenClaw API error: ${res.status}`);
  return res.json();
}

export const openclawApi = {
  getStatus: () => request('/status'),
  listAgents: () => request('/agents'),
  createAgent: (config: { name: string; role: string; model: string; systemPrompt: string }) =>
    request('/agents', { method: 'POST', body: JSON.stringify(config) }),
  deleteAgent: (name: string) => request(`/agents/${name}`, { method: 'DELETE' }),
  sendMessage: (name: string, message: string) =>
    request(`/agents/${name}/message`, { method: 'POST', body: JSON.stringify({ message }) }),
};
