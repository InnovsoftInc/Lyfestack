export interface OpenClawAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
  lastActive?: string;
  agentDir?: string;
}

export interface OpenClawMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface OpenClawConnection {
  ip: string;
  port: number;
  status: 'disconnected' | 'connecting' | 'connected';
  lastConnected?: string;
}

export interface OpenClawSession {
  id: string;
  agentId: string;
  messages: OpenClawMessage[];
  createdAt: string;
  updatedAt: string;
}
