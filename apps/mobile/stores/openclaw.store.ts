import { create } from 'zustand';
import type { OpenClawAgent, OpenClawMessage } from '@lyfestack/shared';
import * as api from '../services/openclaw.api';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface ActiveChat {
  agentId: string;
  messages: OpenClawMessage[];
}

interface OpenClawState {
  connectionStatus: ConnectionStatus;
  localIp: string;
  localPort: number;
  agents: OpenClawAgent[];
  activeChat: ActiveChat | null;
  isLoadingAgents: boolean;
  isSending: boolean;
  error: string | null;

  connect: (ip: string, port: number) => Promise<boolean>;
  disconnect: () => void;
  fetchAgents: () => Promise<void>;
  openChat: (agentId: string) => Promise<void>;
  closeChat: () => void;
  sendMessage: (agentId: string, message: string) => Promise<void>;
  streamMessage: (agentId: string, message: string) => void;
  clearError: () => void;
}

export const useOpenClawStore = create<OpenClawState>((set, get) => ({
  connectionStatus: 'disconnected',
  localIp: 'localhost',
  localPort: 3000,
  agents: [],
  activeChat: null,
  isLoadingAgents: false,
  isSending: false,
  error: null,

  connect: async (ip, port) => {
    set({ connectionStatus: 'connecting', error: null });
    api.setServerUrl(ip, port);
    const ok = await api.connectToLocal(ip, port);
    if (ok) {
      set({ connectionStatus: 'connected', localIp: ip, localPort: port });
      await get().fetchAgents();
    } else {
      set({ connectionStatus: 'disconnected', error: 'Could not connect to OpenClaw' });
    }
    return ok;
  },

  disconnect: () => {
    set({ connectionStatus: 'disconnected', agents: [], activeChat: null });
  },

  fetchAgents: async () => {
    set({ isLoadingAgents: true, error: null });
    try {
      const agents = await api.listAgents();
      set({ agents, isLoadingAgents: false });
    } catch (err) {
      set({ isLoadingAgents: false, error: (err as Error).message });
    }
  },

  openChat: async (agentId) => {
    set({ activeChat: { agentId, messages: [] } });
    try {
      const messages = await api.getHistory(agentId);
      set((s) => ({
        activeChat: s.activeChat?.agentId === agentId ? { agentId, messages } : s.activeChat,
      }));
    } catch {
      // history load failure is non-fatal
    }
  },

  closeChat: () => set({ activeChat: null }),

  sendMessage: async (agentId, message) => {
    const userMsg: OpenClawMessage = {
      id: `user-${Date.now()}`,
      agentId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg] }
        : { agentId, messages: [userMsg] },
      isSending: true,
    }));

    try {
      const { response } = await api.sendMessage(agentId, message);
      const assistantMsg: OpenClawMessage = {
        id: `asst-${Date.now()}`,
        agentId,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? { ...s.activeChat, messages: [...s.activeChat.messages, assistantMsg] }
          : s.activeChat,
        isSending: false,
      }));
    } catch (err) {
      set({ isSending: false, error: (err as Error).message });
    }
  },

  streamMessage: (agentId, message) => {
    const userMsg: OpenClawMessage = {
      id: `user-${Date.now()}`,
      agentId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    const streamId = `stream-${Date.now()}`;
    const streamMsg: OpenClawMessage = {
      id: streamId,
      agentId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg, streamMsg] }
        : { agentId, messages: [userMsg, streamMsg] },
      isSending: true,
    }));

    api.streamMessage(
      agentId,
      message,
      (chunk) => {
        set((s) => {
          if (!s.activeChat) return s;
          return {
            activeChat: {
              ...s.activeChat,
              messages: s.activeChat.messages.map((m) =>
                m.id === streamId ? { ...m, content: m.content + chunk } : m,
              ),
            },
          };
        });
      },
      (_full) => {
        set({ isSending: false });
      },
      (err) => {
        set({ isSending: false, error: err.message });
      },
    );
  },

  clearError: () => set({ error: null }),
}));
