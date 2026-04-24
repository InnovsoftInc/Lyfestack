import { create } from 'zustand';
import {
  openclawApi,
  tryConnect,
  autoDiscover,
  streamAgentMessage,
  resumeAgentStream,
  getStreamStatus,
  StreamEvictedError,
} from '../services/openclaw.api';

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

export interface ActiveStream {
  agentName: string;
  threadId: string | null;
  sessionKey: string | null;
  messageId: string;
  agentMsgId: string;
  cursor: number;
  startedAt: number;
}

export interface ActiveThread {
  agentName: string;
  threadId: string | null;
  activeSessionKey: string | null;
  messages: ChatMessage[];
  lastMessageId?: string;
  total?: number;
}

export interface ThreadMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  sessionKey?: string;
  isError?: boolean;
  errorType?: string;
}

export interface ThreadDetail {
  threadId: string;
  agentName: string;
  title: string;
  activeSessionKey: string | null;
  sessionChain: string[];
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
  total: number;
  activeSession?: SessionSummary | null;
}

interface OpenClawStore {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  connectionUrl: string | null;
  connectionError: string | null;
  agents: Agent[];
  activeChat: ActiveThread | null;
  currentSession: CurrentSession | null;
  agentSessions: SessionSummary[];
  streamAbort: AbortController | null;
  activeStream: ActiveStream | null;
  resumeAbort: AbortController | null;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  createAgent: (config: { name: string; role: string; model: string; systemPrompt: string }) => Promise<void>;
  deleteAgent: (name: string) => Promise<void>;
  sendMessage: (agentName: string, message: string) => Promise<void>;
  sendMessageStream: (agentName: string, message: string, attachments?: ChatAttachment[]) => Promise<void>;
  abortStream: () => void;
  resumeActiveStream: () => Promise<void>;
  hasResumableStream: (agentName: string) => boolean;
  openChat: (agentName: string) => void;
  closeChat: () => void;
  loadThread: (agentName: string, opts?: { limit?: number }) => Promise<ThreadDetail | null>;
  syncThreadTail: (agentName: string) => Promise<void>;
  loadOlderThreadMessages: (agentName: string) => Promise<boolean>;
  rolloverThread: (agentName: string) => Promise<string | null>;
  resetThread: (agentName: string) => Promise<boolean>;
  appendChatMessages: (agentName: string, messages: ChatMessage[]) => void;
  prependChatMessages: (agentName: string, messages: ChatMessage[]) => void;
  setCurrentSession: (session: CurrentSession | null) => void;
  updateSessionUsage: (patch: Partial<Pick<CurrentSession, 'usage' | 'compactionCount' | 'model' | 'contextWindow'>>) => void;
  loadAgentSessions: (agentId: string) => Promise<SessionSummary[]>;
  newSession: (agentId: string) => Promise<SessionSummary | null>;
  deleteSession: (agentId: string, sessionId: string) => Promise<boolean>;
  switchActiveSession: (agentName: string, session: SessionSummary | CurrentSession | null) => void;
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

const TIMESTAMP_PREFIX_RE = /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+\w+\]\s*/;
const RETRY_PREFIX_RE = /^\[Retry after the previous model attempt failed or timed out\]\s*/i;
const TRANSIENT_TOOL_LABELS = new Set(['using tools...']);

function normalizeMessageContent(content: string): string {
  return content
    .replace(RETRY_PREFIX_RE, '')
    .replace(TIMESTAMP_PREFIX_RE, '')
    .trim();
}

function messageContentKey(message: ChatMessage): string {
  return `${message.role}::${normalizeMessageContent(message.content).slice(0, 160)}`;
}

function isSameServerMessage(left: ChatMessage, right: ChatMessage): boolean {
  return messageContentKey(left) === messageContentKey(right);
}

function mergeIncomingMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const next = [...existing];
  let changed = false;

  for (const message of incoming) {
    const exactIndex = next.findIndex((item) => item.id === message.id);
    if (exactIndex >= 0) {
      next[exactIndex] = { ...next[exactIndex], ...message };
      changed = true;
      continue;
    }

    const localEchoIndex = next.findIndex((item) => {
      if (item.role !== message.role) return false;
      if (item.isError || message.isError) return false;
      if (item.attachments?.length) return false;
      return isSameServerMessage(item, message);
    });

    if (localEchoIndex >= 0) {
      next[localEchoIndex] = {
        ...next[localEchoIndex],
        ...message,
        id: message.id,
        streaming: false,
        toolActivity: null,
      };
      changed = true;
      continue;
    }

    next.push(message);
    changed = true;
  }

  return changed ? next : existing;
}

function scheduleThreadUsageRefresh(agentName: string, getState: typeof useOpenClawStore.getState) {
  const refresh = () => {
    const store = getState();
    void store.syncThreadTail(agentName);
    void store.loadAgentSessions(agentName);
  };

  refresh();
  setTimeout(refresh, 180);
  setTimeout(refresh, 600);
}

function isTransientStreamDisconnect(message: string | undefined | null): boolean {
  const value = String(message ?? '').toLowerCase();
  return (
    value.includes('network request failed')
    || value.includes('request timed out')
    || value.includes('network error')
    || value.includes('stream failed')
  );
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
  activeStream: null,
  resumeAbort: null,

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
      const res: any = await openclawApi.listAgents();
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
        : {
            agentName,
            threadId: null,
            activeSessionKey: s.currentSession?.key ?? null,
            messages: [userMsg],
          },
    }));
    try {
      log('sendMessage()', { agentName });
      const res: any = await openclawApi.sendMessage(agentName, message);
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: res.data?.response ?? res.data?.message ?? JSON.stringify(res.data),
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? {
              ...s.activeChat,
              threadId: res.data?.threadId ?? s.activeChat.threadId,
              activeSessionKey: res.data?.sessionKey ?? s.activeChat.activeSessionKey,
              messages: [...s.activeChat.messages, agentMsg],
            }
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
        : {
            agentName,
            threadId: null,
            activeSessionKey: s.currentSession?.key ?? null,
            messages: [userMsg],
          },
    }));

    const agentMsgId = (Date.now() + 1).toString();
    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      activeStream: {
        agentName,
        threadId: s.activeChat?.threadId ?? null,
        sessionKey: s.activeChat?.activeSessionKey ?? null,
        messageId: clientMessageId,
        agentMsgId,
        cursor: 0,
        startedAt: Date.now(),
      },
    }));

    const abort = new AbortController();
    set({ streamAbort: abort });

    log('sendMessageStream()', { agentName, messageId: clientMessageId });
    try {
    await streamAgentMessage(agentName, fullMessage, {
      messageId: clientMessageId,
      signal: abort.signal,
      onInit: (info) => {
        set((s) => {
          const nextStream = s.activeStream
            ? {
                ...s.activeStream,
                ...(info.messageId && info.messageId !== s.activeStream.messageId ? { messageId: info.messageId } : {}),
                ...(info.threadId ? { threadId: info.threadId } : {}),
                ...(info.activeSessionKey ? { sessionKey: info.activeSessionKey } : {}),
              }
            : s.activeStream;
          const nextChat =
            s.activeChat && s.activeChat.agentName === agentName
              ? {
                  ...s.activeChat,
                  ...(info.threadId ? { threadId: info.threadId } : {}),
                  ...(info.activeSessionKey ? { activeSessionKey: info.activeSessionKey } : {}),
                }
              : s.activeChat;
          return { activeStream: nextStream, activeChat: nextChat };
        });
      },
      onRollover: (info) => {
        set((s) => {
          if (!s.activeChat || s.activeChat.agentName !== agentName) return s;
          return {
            activeChat: {
              ...s.activeChat,
              activeSessionKey: info.activeSessionKey ?? s.activeChat.activeSessionKey,
            },
          };
        });
      },
      onCursor: (cursor) => {
        set((s) => (s.activeStream ? { activeStream: { ...s.activeStream, cursor } } : s));
      },
      onChunk: (chunk) => {
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
      onDone: (response, info) => {
        set((s) => {
          if (!s.activeChat) return { streamAbort: null, activeStream: null };
          return {
            streamAbort: null,
            activeStream: null,
            activeChat: {
              ...s.activeChat,
              ...(info?.threadId ? { threadId: info.threadId } : {}),
              ...(info?.activeSessionKey ? { activeSessionKey: info.activeSessionKey } : {}),
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? {
                      ...m,
                      content: response || m.content,
                      streaming: false,
                      toolActivity: null,
                      toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                    }
                  : m,
              ),
            },
          };
        });
        scheduleThreadUsageRefresh(agentName, get);
      },
      onError: (err) => {
        if (abort.signal.aborted) return;
        log('sendMessageStream() error', err.message);
        const rawMsg = err.message ?? 'Stream failed';
        if (isTransientStreamDisconnect(rawMsg)) {
          set((s) => {
            if (!s.activeChat) return { streamAbort: null };
            return {
              streamAbort: null,
              activeChat: {
                ...s.activeChat,
                messages: s.activeChat.messages.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        streaming: true,
                        toolActivity: null,
                        toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                      }
                    : m,
                ),
              },
            };
          });
          return;
        }
        set((s) => {
          if (!s.activeChat) return { streamAbort: null, activeStream: null };
          return {
            streamAbort: null,
            activeStream: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? {
                      ...m,
                      content: rawMsg,
                      streaming: false,
                      isError: true,
                      errorType: classifyError(rawMsg),
                      toolActivity: null,
                      toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                    }
                  : m,
              ),
            },
          };
        });
      },
      onToolActivity: (toolName) => {
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
                      toolHistory: toolName && !TRANSIENT_TOOL_LABELS.has(toolName) && !(m.toolHistory ?? []).includes(toolName)
                        ? [...(m.toolHistory ?? []), toolName]
                        : (m.toolHistory ?? []),
                    }
                  : m,
              ),
            },
          };
        });
      },
    });
    } catch (err: any) {
      if (!abort.signal.aborted) {
        log('sendMessageStream() uncaught throw', err?.message);
      }
    }

    // Safety net: if stream completed without onDone/onError, finalize the message
    const state = get();
    if (state.streamAbort) {
      log('sendMessageStream() — stream ended without onDone, finalizing');
      set((s) => {
        if (!s.activeChat) return { streamAbort: null, activeStream: null };
        return {
          streamAbort: null,
          activeStream: null,
          activeChat: {
            ...s.activeChat,
            messages: s.activeChat.messages.map((m) =>
              m.id === agentMsgId
                ? {
                    ...m,
                    streaming: false,
                    toolActivity: null,
                    toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                  }
                : m,
            ),
          },
        };
      });
    }
  },

  hasResumableStream: (agentName) => {
    const { activeStream, activeChat } = get();
    if (!activeStream || activeStream.agentName !== agentName) return false;
    if (!activeChat) return false;
    const msg = activeChat.messages.find((m) => m.id === activeStream.agentMsgId);
    return Boolean(msg?.streaming);
  },

  resumeActiveStream: async () => {
    const { activeStream, resumeAbort } = get();
    if (!activeStream) return;
    if (resumeAbort) {
      log('resumeActiveStream() — already resuming, skipping');
      return;
    }

    // Cheap server check first — if the stream is already complete or evicted we can skip the SSE.
    try {
      const status = await getStreamStatus(activeStream.messageId);
      if (status === null) {
        log('resumeActiveStream() — stream evicted on server', { messageId: activeStream.messageId });
        const msgId = activeStream.agentMsgId;
        set((s) => {
          if (!s.activeChat) return { activeStream: null };
          return {
            activeStream: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === msgId
                  ? { ...m, streaming: false, isError: true, errorType: 'generic' as ChatErrorType, toolActivity: null, content: m.content || 'Stream lost — please retry.' }
                  : m,
              ),
            },
          };
        });
        return;
      }
    } catch (err: any) {
      log('resumeActiveStream() — status check failed', err?.message);
      // Fall through and try to resume anyway.
    }

    const abort = new AbortController();
    set({ resumeAbort: abort });
    const agentMsgId = activeStream.agentMsgId;

    log('resumeActiveStream() — opening resume SSE', { messageId: activeStream.messageId, cursor: activeStream.cursor });
    try {
    await resumeAgentStream(activeStream.agentName, activeStream.messageId, activeStream.cursor, {
      signal: abort.signal,
      onCursor: (cursor) => {
        set((s) => (s.activeStream ? { activeStream: { ...s.activeStream, cursor } } : s));
      },
      onChunk: (chunk) => {
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
      onDone: (response) => {
        set((s) => {
          if (!s.activeChat) return { resumeAbort: null, activeStream: null };
          return {
            resumeAbort: null,
            activeStream: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? {
                      ...m,
                      content: response || m.content,
                      streaming: false,
                      toolActivity: null,
                      toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                    }
                  : m,
              ),
            },
          };
        });
        scheduleThreadUsageRefresh(activeStream.agentName, get);
      },
      onError: (err) => {
        const rawMsg = err.message ?? 'Stream resume failed';
        const evicted = err instanceof StreamEvictedError;
        log('resumeActiveStream() error', { rawMsg, evicted });
        if (!evicted && isTransientStreamDisconnect(rawMsg)) {
          set((s) => {
            if (!s.activeChat) return { resumeAbort: null };
            return {
              resumeAbort: null,
              activeChat: {
                ...s.activeChat,
                messages: s.activeChat.messages.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        streaming: true,
                        toolActivity: null,
                        toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                      }
                    : m,
                ),
              },
            };
          });
          return;
        }
        set((s) => {
          if (!s.activeChat) return { resumeAbort: null, activeStream: null };
          return {
            resumeAbort: null,
            activeStream: null,
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === agentMsgId
                  ? {
                      ...m,
                      streaming: false,
                      isError: true,
                      errorType: classifyError(rawMsg),
                      toolActivity: null,
                      content: m.content || rawMsg,
                      toolHistory: (m.toolHistory ?? []).filter((tool) => !TRANSIENT_TOOL_LABELS.has(tool)),
                    }
                  : m,
              ),
            },
          };
        });
      },
      onToolActivity: (toolName) => {
        set((s) => {
          if (!s.activeChat) return s;
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
                      toolHistory: toolName && !TRANSIENT_TOOL_LABELS.has(toolName) && !(m.toolHistory ?? []).includes(toolName)
                        ? [...(m.toolHistory ?? []), toolName]
                        : (m.toolHistory ?? []),
                    }
                  : m,
              ),
            },
          };
        });
      },
    });
    } catch (err: any) {
      log('resumeActiveStream() uncaught throw', err?.message);
    } finally {
      // Ensure resumeAbort is always cleared even if resumeAgentStream throws.
      if (get().resumeAbort) set({ resumeAbort: null });
    }
  },

  abortStream: () => {
    const { streamAbort } = get();
    if (streamAbort) {
      streamAbort.abort();
      set((s) => {
        if (!s.activeChat) return { streamAbort: null, activeStream: null };
        return {
          streamAbort: null,
          activeStream: null,
          activeChat: {
            ...s.activeChat,
            messages: s.activeChat.messages.map((m) =>
              m.streaming ? { ...m, streaming: false, toolActivity: null } : m,
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
    set({
      activeChat: { agentName, threadId: null, activeSessionKey: null, messages: [] },
      currentSession: null,
      agentSessions: [],
    });
  },

  closeChat: () => set({ activeChat: null, currentSession: null, agentSessions: [] }),

  appendChatMessages: (agentName, messages) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return;
    if (!messages.length) return;
    const merged = mergeIncomingMessages(activeChat.messages, messages);
    if (merged === activeChat.messages) return;
    const last = merged[merged.length - 1];
    set({
      activeChat: {
        ...activeChat,
        messages: merged,
        ...(last ? { lastMessageId: last.id } : {}),
      },
    });
  },

  prependChatMessages: (agentName, messages) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return;
    if (!messages.length) return;
    const existing = new Set(activeChat.messages.map((m) => m.id));
    const existingContent = new Set(activeChat.messages.map(messageContentKey));
    const fresh = messages.filter((m) => !existing.has(m.id) && !existingContent.has(messageContentKey(m)));
    if (!fresh.length) return;
    set({ activeChat: { ...activeChat, messages: [...fresh, ...activeChat.messages] } });
  },

  loadThread: async (agentName, opts) => {
    try {
      const res: any = await openclawApi.getThread(agentName, { ensure: true, limit: opts?.limit ?? 50 });
      const detail: ThreadDetail = res.data;
      if (!detail) return null;
      const mapped: ChatMessage[] = (detail.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.isError ? { isError: true } : {}),
        ...(m.errorType ? { errorType: m.errorType as ChatErrorType } : {}),
      }));
      const last = mapped[mapped.length - 1];
      set((s) => {
        const next: ActiveThread = {
          agentName,
          threadId: detail.threadId,
          activeSessionKey: detail.activeSessionKey,
          messages: mapped,
          total: detail.total,
          ...(last ? { lastMessageId: last.id } : {}),
        };
        const session = detail.activeSession;
        return {
          activeChat: s.activeChat?.agentName === agentName ? next : s.activeChat,
          currentSession: session
            ? {
                key: session.key,
                agentId: session.agentId,
                sessionId: session.sessionId,
                model: session.model,
                contextWindow: session.contextWindow,
                usage: session.usage,
                compactionCount: session.compactionCount,
              }
            : s.currentSession,
        };
      });
      return detail;
    } catch (err: any) {
      log('loadThread() error', err?.message);
      return null;
    }
  },

  syncThreadTail: async (agentName) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return;
    const afterId = activeChat.lastMessageId;
    try {
      const res: any = await openclawApi.getThread(agentName, {
        ...(afterId ? { afterId } : { limit: 50 }),
      });
      const detail: ThreadDetail | undefined = res.data;
      if (!detail) return;
      const mapped: ChatMessage[] = (detail.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.isError ? { isError: true } : {}),
        ...(m.errorType ? { errorType: m.errorType as ChatErrorType } : {}),
      }));
      if (mapped.length) {
        get().appendChatMessages(agentName, mapped);
      }
      set((s) => {
        const session = detail.activeSession;
        const nextChat = s.activeChat?.agentName === agentName
          ? {
              ...s.activeChat,
              ...(detail.threadId ? { threadId: detail.threadId } : {}),
              ...(detail.activeSessionKey !== undefined ? { activeSessionKey: detail.activeSessionKey } : {}),
              total: detail.total,
            }
          : s.activeChat;
        return {
          activeChat: nextChat,
          currentSession: session
            ? {
                key: session.key,
                agentId: session.agentId,
                sessionId: session.sessionId,
                model: session.model,
                contextWindow: session.contextWindow,
                usage: session.usage,
                compactionCount: session.compactionCount,
              }
            : s.currentSession,
        };
      });
    } catch (err: any) {
      log('syncThreadTail() error', err?.message);
    }
  },

  loadOlderThreadMessages: async (agentName) => {
    const { activeChat } = get();
    if (!activeChat || activeChat.agentName !== agentName) return false;
    const oldest = activeChat.messages[0];
    if (!oldest) return false;
    try {
      const res: any = await openclawApi.getThread(agentName, { beforeId: oldest.id, limit: 50 });
      const detail: ThreadDetail | undefined = res.data;
      if (!detail || !detail.messages?.length) return false;
      const mapped: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.isError ? { isError: true } : {}),
        ...(m.errorType ? { errorType: m.errorType as ChatErrorType } : {}),
      }));
      get().prependChatMessages(agentName, mapped);
      return true;
    } catch (err: any) {
      log('loadOlderThreadMessages() error', err?.message);
      return false;
    }
  },

  rolloverThread: async (agentName) => {
    try {
      const res: any = await openclawApi.rolloverThread(agentName);
      const sessionKey: string | null = res.data?.sessionKey ?? null;
      set((s) => ({
        activeChat: s.activeChat?.agentName === agentName
          ? { ...s.activeChat, activeSessionKey: sessionKey }
          : s.activeChat,
      }));
      return sessionKey;
    } catch (err: any) {
      log('rolloverThread() error', err?.message);
      return null;
    }
  },

  resetThread: async (agentName) => {
    try {
      await openclawApi.resetThread(agentName);
      set((s) => {
        if (s.activeChat?.agentName !== agentName) return { currentSession: null };
        const { lastMessageId: _lastMessageId, ...rest } = s.activeChat;
        void _lastMessageId;
        return {
          activeChat: {
            ...rest,
            threadId: null,
            activeSessionKey: null,
            messages: [],
            total: 0,
          },
          currentSession: null,
        };
      });
      return true;
    } catch (err: any) {
      log('resetThread() error', err?.message);
      return false;
    }
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
      const { currentSession } = get();
      if (currentSession?.key === key) set({ currentSession: null });
      return true;
    } catch (err: any) {
      log('deleteSession() error', err?.message);
      return false;
    }
  },

  switchActiveSession: (agentName, session) => {
    set((s) => {
      const activeChat = s.activeChat?.agentName === agentName
        ? { ...s.activeChat, activeSessionKey: session?.key ?? null }
        : s.activeChat;
      return {
        activeChat,
        currentSession: session
          ? {
              key: session.key,
              agentId: session.agentId,
              sessionId: session.sessionId,
              model: session.model,
              contextWindow: session.contextWindow,
              usage: session.usage,
              compactionCount: session.compactionCount,
            }
          : null,
      };
    });
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
