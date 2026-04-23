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

export type OpenClawWildCardTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface OpenClawWildCardField {
  label: string;
  value: string;
}

export interface OpenClawWildCard {
  id?: string;
  title: string;
  subtitle?: string;
  body?: string;
  tone?: OpenClawWildCardTone;
  fields?: OpenClawWildCardField[];
}

export interface OpenClawAgentReply {
  response: string;
  wildcards?: OpenClawWildCard[];
}

export interface OpenClawMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  wildcards?: OpenClawWildCard[];
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
