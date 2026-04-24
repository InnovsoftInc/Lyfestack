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

export interface SessionUsage {
  totalTokens: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  lastCacheReadTokens: number;
  contextUsedTokens: number;
  totalTokensFresh: boolean;
}

export interface OpenClawSessionSummary {
  key: string;
  agentId: string;
  sessionId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  contextWindow: number;
  usage: SessionUsage;
  compactionCount: number;
}

export interface SessionMessagePayload {
  index: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export interface OpenClawSessionDetail {
  key: string;
  messages: SessionMessagePayload[];
  total: number;
  firstIndex: number;
  lastIndex: number;
  model: string;
  contextWindow: number;
  usage: SessionUsage;
  compactionCount: number;
}

export interface SessionActionResult {
  ok: boolean;
  session?: OpenClawSessionSummary;
  error?: string;
}

// ── Threads (Phase 2) ──────────────────────────────────────────────────────
// A thread is LyfeStack's canonical visible chat history, one per agent.
// It is decoupled from OpenClaw sessions: the thread outlives session
// rollover / compaction so the user sees one continuous conversation even
// when the backend runtime container (session) has been rotated.

export type ThreadRole = 'user' | 'agent';

export interface ThreadMessage {
  id: string;
  role: ThreadRole;
  content: string;
  timestamp: string;
  sessionKey?: string;
  isError?: boolean;
  errorType?: string;
}

export interface OpenClawThread {
  threadId: string;
  agentName: string;
  title: string;
  activeSessionKey: string | null;
  sessionChain: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OpenClawThreadDetail extends OpenClawThread {
  messages: ThreadMessage[];
  total: number;
  activeSession?: OpenClawSessionSummary | null;
}
