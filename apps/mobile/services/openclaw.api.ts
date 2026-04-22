import type { OpenClawAgent, OpenClawMessage } from '@lyfestack/shared';

const DEFAULT_PORT = 3000;
const COMMON_PORTS = [3000, 3001, 4000, 8080];

let baseUrl = `http://localhost:${DEFAULT_PORT}`;

export function setServerUrl(ip: string, port: number) {
  baseUrl = `http://${ip}:${port}`;
}

export function getServerUrl(): string {
  return baseUrl;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
}

export async function connectToLocal(ip: string, port: number): Promise<boolean> {
  setServerUrl(ip, port);
  try {
    await get<{ connected: boolean }>('/openclaw/status');
    return true;
  } catch {
    return false;
  }
}

export async function discoverLocal(): Promise<{ ip: string; port: number } | null> {
  const candidates = ['localhost', '127.0.0.1'];
  for (const ip of candidates) {
    for (const port of COMMON_PORTS) {
      const found = await connectToLocal(ip, port);
      if (found) return { ip, port };
    }
  }
  return null;
}

export async function getGatewayStatus(): Promise<{ connected: boolean; port: number }> {
  return get('/openclaw/status');
}

export async function listAgents(): Promise<OpenClawAgent[]> {
  return get('/openclaw/agents');
}

export async function getAgent(id: string): Promise<OpenClawAgent> {
  return get(`/openclaw/agents/${id}`);
}

export async function createAgent(params: {
  id: string;
  name?: string;
  role?: string;
  systemPrompt?: string;
}): Promise<OpenClawAgent> {
  return post('/openclaw/agents', params);
}

export async function deleteAgent(id: string): Promise<void> {
  return del(`/openclaw/agents/${id}`);
}

export async function sendMessage(
  agentId: string,
  message: string,
): Promise<{ response: string }> {
  return post(`/openclaw/agents/${agentId}/message`, { message });
}

export async function getHistory(agentId: string, limit = 50): Promise<OpenClawMessage[]> {
  return get(`/openclaw/agents/${agentId}/history?limit=${limit}`);
}

export async function getAgentStatus(agentId: string): Promise<{ status: string }> {
  return get(`/openclaw/agents/${agentId}/status`);
}

export function streamMessage(
  agentId: string,
  message: string,
  onChunk: (chunk: string) => void,
  onDone: (full: string) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  fetch(`${baseUrl}/openclaw/agents/${agentId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { chunk?: string; done?: boolean; response?: string };
            if (payload.chunk) onChunk(payload.chunk);
            if (payload.done) onDone(payload.response ?? '');
          } catch {
            // skip malformed SSE
          }
        }
      }
    })
    .catch((err: unknown) => {
      if ((err as Error)?.name !== 'AbortError') {
        onError(err as Error);
      }
    });

  return () => controller.abort();
}
