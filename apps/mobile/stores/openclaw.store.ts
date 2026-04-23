import { create } from 'zustand';
import { openclawApi, tryConnect, autoDiscover, streamAgentMessage } from '../services/openclaw.api';

interface Agent {
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
}

export type ChatErrorType = 'billing' | 'rate_limit' | 'all_failed' | 'generic';

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'file';
  uri: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  isError?: boolean;
  errorType?: ChatErrorType;
  streaming?: boolean;
  attachments?: ChatAttachment[];
  toolActivity?: string | null;
  toolHistory?: string[];
}

function classifyError(msg: string): ChatErrorType {
  const lower = msg.toLowerCase();
  const hasBilling = lower.includes('billing') || lower.includes('out of credits') || lower.includes('insufficient balance') || lower.includes('402');
  const hasRateLimit = lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('429');
  const allFailed = lower.includes('all models failed');
  if (allFailed) return hasBilling ? 'billing' : hasRateLimit ? 'rate_limit' : 'all_failed';
  if (hasBilling) return 'billing';
  if (hasRateLimit) return 'rate_limit';
  return 'generic';
}

export interface SessionUsage {
  totalTokens: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  lastCacheReadTokens: number;
  contextUsedTokens: number;
  totalTokensFresh: boolean;
}

export interface SessionSummary {
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

export interface CurrentSession {
  key: string;
  agentId: string;
  sessionId: string;
  model: string;
  contextWindow: number;
  usage: SessionUsage;
  compactionCount: number;
}

interface OpenClawStore {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  connectionUrl: string | null;
  connectionError: string | null;
  agents: Agent[];
  activeChat: { agentName: string; sessionKey: string | null; messages: ChatMessage[] } | null;
  currentSession: CurrentSession | null;
  agentSessions: SessionSummary[];
  streamAbort: AbortController | null;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  createAgent: (config: { name: string; role: string; model: string; systemPrompt: string }) => Promise<void>;
  deleteAgent: (name: string) => Promise<void>;
  sendMessage: (agentName: string, message: string) => Promise<void>;
  sendMessageStream: (agentName: string, message: string, attachments?: ChatAttachment[]) => Promise<void>;
  abortStream: () => void;
  openChat: (agentName: string) => void;
  closeChat: () => void;
  loadChatHistory: (agentName: string, sessionKey: string, messages: ChatMessage[]) => void;
  appendChatMessages: (agentName: string, sessionKey: string, messages: ChatMessage[]) => void;
  prependChatMessages: (agentName: string, sessionKey: string, messages: ChatMessage[]) => void;
  setCurrentSession: (session: CurrentSession | null) => void;
  updateSessionUsage: (patch: Partial<Pick<CurrentSession, 'usage' | 'compactionCount' | 'model' | 'contextWindow'>>) => void;
  loadAgentSessions: (agentId: string) => Promise<SessionSummary[]>;
  newSession: (agentId: string) => Promise<SessionSummary | null>;
  deleteSession: (agentId: string, sessionId: string) => Promise<boolean>;
  startHeartbeat: () => void;
  stopHeartbeat: () => void;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_MS = 15_000;

function log(msg: string, data?: unknown) {
  const ts = new Date().toLocaleTimeString('en-CA', { hour12: false });
  if (data !== undefined) {
    console.log(`[OpenClaw ${ts}] ${msg}`, data);
  } else {
    console.log(`[OpenClaw ${ts}] ${msg}`);
  }
}

export const useOpenClawStore = create<OpenClawStore>((set, get) => ({
  connectionStatus: 'disconnected',
  connectionUrl: null,
  connectionError: null,
  agents: [],
  activeChat: null,
  currentSession: null,
  agentSessions: [],
  streamAbort: null,

  connect: async () => {
    if (get().connectionStatus === 'connecting') {
      log('connect() skipped — already connecting');
      return;
    }
    log('connect() starting...');
    set({ connectionStatus: 'connecting', connectionError: null });

    try {
      // Fast path: try saved connection
      const fast = await tryConnect();
      if (fast) {
        log('connect() fast path succeeded', { url: fast });
        set({ connectionStatus: 'connected', connectionUrl: fast });
        await get().fetchAgents();
        get().startHeartbeat();
        return;
      }

      log('connect() fast path failed — starting auto-discover...');
      const found = await autoDiscover();
      if (found) {
        log('connect() auto-discover succeeded', { url: found });
        set({ connectionStatus: 'connected', connectionUrl: found });
        await get().fetchAgents();
        get().startHeartbeat();
      } else {
        log('connect() auto-discover failed — no server found');
        set({ connectionStatus: 'disconnected', connectionError: 'Server not found on network. Make sure it is running.' });
      }
    } catch (err: any) {
      log('connect() error', err?.message);
      set({ connectionStatus: 'disconnected', connectionError: err?.message ?? 'Connection failed' });
    }
  },

  reconnect: async () => {
    log('reconnect() — forcing full reconnect');
    get().stopHeartbeat();
    set({ connectionStatus: 'disconnected', connectionError: null });
    await get().connect();
  },

  fetchAgents: async () => {
    try {
      log('fetchAgents()');
      const res = await openclawApi.listAgents();
      const agents = res.data ?? [];
      log('fetchAgents() got agents', { count: agents.length });
      set({ agents });
    } catch (err: any) {
      log('fetchAgents() error — marking disconnected', err?.message);
      set({ connectionStatus: 'disconnected', connectionError: 'Lost connection to server' });
      get().stopHeartbeat();
    }
  },

  createAgent: async (config) => {
    log('createAgent()', { name: config.name });
    await openclawApi.createAgent(config);
    await get().fetchAgents();
  },

  deleteAgent: async (name) => {
    log('deleteAgent()', { name });
    await openclawApi.deleteAgent(name);
    set((s) => ({ agents: s.agents.filter((a) => a.name !== name) }));
  },

  sendMessage: async (agentName, message) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg] }
        : { agentName, sessionKey: s.currentSession?.key ?? null, messages: [userMsg] },
    }));
    try {
      log('sendMessage()', { agentName });
      const res = await openclawApi.sendMessage(agentName, message);
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: res.data?.response ?? res.data?.message ?? JSON.stringify(res.data),
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? { ...s.activeChat, messages: [...s.activeChat.messages, agentMsg] }
          : null,
      }));
    } catch (err: any) {
      log('sendMessage() error', err?.message);
      const rawMsg: string = err?.message ?? 'Failed to get response';
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: rawMsg,
        timestamp: new Date().toISOString(),
        isError: true,
        errorType: classifyError(rawMsg),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? { ...s.activeChat, messages: [...s.activeChat.messages, errMsg] }
          : null,
      }));
    }
  },

  sendMessageStream: async (agentName, message, attachments) => {
    // Build full message: prepend any text attachments as context blocks
    let fullMessage = message;
    const textAttachments = attachments?.filter((a) => a.type === 'text') ?? [];
    if (textAttachments.length > 0) {
      const context = textAttachments
        .map((a) => `<context file="${a.name}">\n${a.uri}\n</context>`)
        .join('\n\n');
      fullMessage = `${context}\n\n${message}`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      ...(attachments?.length && { attachments }),
    };
    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg] }
        : { agentName, sessionKey: s.currentSession?.key ?? null, messages: [userMsg] },
    }));

    const agentMsgId = (Date.now() + 1).toString();
    const placeholder: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    };
    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, placeholder] }
        : null,
    }));

    const abort = new AbortController();
    set({ streamAbort: abort });

    log('sendMessageStream()', { agentName });
    await streamAgentMessage(
      agentName,
      fullMessage,
      (chunk) => {
        set((s) => {
          if (!s.activeChat) return s;
          return {
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId ? { ...m, content: m.content + chunk } : m,
              ),
            },
          };
        });
      },
      (response) => {
        set((s) => {
          if (!s.activeChat) return s;
          return {
            streamAbort: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId ? { ...m, content: response, streaming: false, toolActivity: null, toolHistory: m.toolHistory ?? [] } : m,
              ),
            },
          };
        });
      },
      (err) => {
        log('sendMessageStream() error', err.message);
        const rawMsg = err.message ?? 'Stream failed';
        set((s) => {
          if (!s.activeChat) return s;
          return {
            streamAbort: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? { ...m, content: rawMsg, streaming: false, isError: true, errorType: classifyError(rawMsg), toolActivity: null }
                  : m,
              ),
            },
          };
        });
      },
      abort.signal,
      (toolName) => {
        set((s) => {
          if (!s.activeChat) return s;
          // '__done_current__' = text started streaming, mark current tool as done
          if (toolName === '__done_current__') {
            return {
              activeChat: {
                ...s.activeChat,
                messages: s.activeChat.messages.map((m) =>
                  m.id === agentMsgId ? { ...m, toolActivity: null } : m,
                ),
              },
            };
          }
          return {
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? {
                      ...m,
                      toolActivity: toolName,
                      toolHistory: [...(m.toolHistory ?? []), toolName],
                    }
                  : m,
              ),
            },
          };
        });
      },
    );

    // Safety net: if stream completed without onDone/onError, finalize the message
    const state = get();
    if (state.streamAbort) {
      log('sendMessageStream() — stream ended without onDone, finalizing');
      set((s) => {
        if (!s.activeChat) return { streamAbort: null };
        return {
          streamAbort: null,
          activeChat: {
            ...s.activeChat,
            messages: s.activeChat.messages.map((m) =>
              m.id === agentMsgId ? { ...m, streaming: false, toolActivity: null } : m,
            ),
          },
        };
      });
    }
  },

  abortStream: () => {
    const { streamAbort } = get();
    if (streamAbort) {
      streamAbort.abort();
      set((s) => {
        if (!s.activeChat) return { streamAbort: null };
        return {
          streamAbort: null,
          activeChat: {
            ...s.activeChat,
            messages: s.activeChat.messages.map((m) =>
              m.streaming ? { ...m, streaming: false } : m,
            ),
          },
        };
      });
    }
  },

  openChat: (agentName) => {
    const current = get().activeChat;
    if (current?.agentName === agentName) return;
    log('openChat()', { agentName });
    set({ activeChat: { agentName, sessionKey: null, messages: [] }, currentSession: null, agentSessions: [] });
  },

  closeChat: () => set({ activeChat: null, currentSession: null, agentSessions: [] }),

  loadChatHistory: (agentName, sessionKey, messages) => {
    const current = get().activeChat;
    if (!current || current.agentName !== agentName) return;
    if (current.sessionKey && current.sessionKey !== sessionKey) return;
    if (current.messages.length === 0) {
      set({ activeChat: { agentName, sessionKey, messages } });
    } else if (!current.sessionKey) {
      set({ activeChat: { ...current, sessionKey } });
    }
  },

  appendChatMessages: (agentName, sessionKey, messages) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return;
    if (activeChat.sessionKey && activeChat.sessionKey !== sessionKey) return;
    if (!messages.length) return;
    // Dedupe by ID and also by content+role (local vs server IDs differ for same message)
    const existingIds = new Set(activeChat.messages.map((m) => m.id));
    const existingContent = new Set(
      activeChat.messages.map((m) => `${m.role}::${m.content.slice(0, 100)}`)
    );
    const fresh = messages.filter((m) => {
      if (existingIds.has(m.id)) return false;
      const contentKey = `${m.role}::${m.content.slice(0, 100)}`;
      if (existingContent.has(contentKey)) return false;
      return true;
    });
    if (!fresh.length) return;
    set({ activeChat: { ...activeChat, sessionKey: activeChat.sessionKey ?? sessionKey, messages: [...activeChat.messages, ...fresh] } });
  },

  prependChatMessages: (agentName, sessionKey, messages) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return;
    if (activeChat.sessionKey && activeChat.sessionKey !== sessionKey) return;
    if (!messages.length) return;
    const existing = new Set(activeChat.messages.map((m) => m.id));
    const fresh = messages.filter((m) => !existing.has(m.id));
    if (!fresh.length) return;
    set({ activeChat: { ...activeChat, sessionKey: activeChat.sessionKey ?? sessionKey, messages: [...fresh, ...activeChat.messages] } });
  },

  setCurrentSession: (session) => set({ currentSession: session }),

  updateSessionUsage: (patch) => {
    const { currentSession } = get();
    if (!currentSession) return;
    set({ currentSession: { ...currentSession, ...patch } });
  },

  loadAgentSessions: async (agentId) => {
    try {
      const res: any = await openclawApi.listSessions({ agentId, limit: 50 });
      const sessions: SessionSummary[] = res.data ?? [];
      set({ agentSessions: sessions });
      return sessions;
    } catch (err: any) {
      log('loadAgentSessions() error', err?.message);
      return [];
    }
  },

  newSession: async (agentId) => {
    try {
      log('newSession()', { agentId });
      const res: any = await openclawApi.createSession(agentId);
      const session: SessionSummary | undefined = res.data;
      if (!session) return null;
      set((s) => ({ agentSessions: [session, ...s.agentSessions] }));
      return session;
    } catch (err: any) {
      log('newSession() error', err?.message);
      return null;
    }
  },

  deleteSession: async (agentId, sessionId) => {
    try {
      log('deleteSession()', { agentId, sessionId });
      await openclawApi.deleteSession(agentId, sessionId);
      const key = `${agentId}/${sessionId}`;
      set((s) => ({
        agentSessions: s.agentSessions.filter((sess) => sess.key !== key),
      }));
      const { activeChat, currentSession } = get();
      if (currentSession?.key === key) set({ currentSession: null });
      if (activeChat?.sessionKey === key) {
        set({ activeChat: { agentName: activeChat.agentName, sessionKey: null, messages: [] } });
      }
      return true;
    } catch (err: any) {
      log('deleteSession() error', err?.message);
      return false;
    }
  },

  startHeartbeat: () => {
    if (heartbeatTimer) return;
    log(`startHeartbeat() — checking every ${HEARTBEAT_MS / 1000}s`);
    heartbeatTimer = setInterval(async () => {
      const { connectionStatus, fetchAgents } = useOpenClawStore.getState();
      if (connectionStatus === 'connecting') return;

      try {
        await openclawApi.getStatus();
        if (connectionStatus === 'disconnected') {
          log('heartbeat — server back online, reconnecting');
          useOpenClawStore.setState({ connectionStatus: 'connected', connectionError: null });
          await fetchAgents();
        } else {
          log('heartbeat — ok');
        }
      } catch {
        if (connectionStatus === 'connected') {
          log('heartbeat — connection lost, attempting fast reconnect...');
          useOpenClawStore.setState({ connectionStatus: 'disconnected', connectionError: 'Lost connection to server' });
          // Try fast path only (don't trigger full network scan)
          const url = await tryConnect();
          if (url) {
            log('heartbeat — fast reconnect succeeded', { url });
            useOpenClawStore.setState({ connectionStatus: 'connected', connectionUrl: url, connectionError: null });
            await fetchAgents();
          } else {
            log('heartbeat — fast reconnect failed, staying disconnected');
          }
        } else {
          log('heartbeat — still disconnected, trying fast reconnect...');
          const url = await tryConnect();
          if (url) {
            log('heartbeat — reconnected from disconnected state', { url });
            useOpenClawStore.setState({ connectionStatus: 'connected', connectionUrl: url, connectionError: null });
            await fetchAgents();
          }
        }
      }
    }, HEARTBEAT_MS);
  },

  stopHeartbeat: () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      log('stopHeartbeat()');
    }
  },
}));
