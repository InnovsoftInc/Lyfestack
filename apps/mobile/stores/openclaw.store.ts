import { create } from 'zustand';
import { openclawApi } from '../services/openclaw.api';

interface Agent {
  id: string;
  name?: string;
  model: { primary: string; fallbacks: string[] };
  workspace: string;
}

interface Session {
  key: string;
  sessionId: string;
  displayName?: string;
  status: string;
  updatedAt: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  model?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface OpenClawStore {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  agents: Agent[];
  sessions: Session[];
  activeChat: { agentId: string; messages: ChatMessage[] } | null;

  connect: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  createAgent: (config: { name: string; model?: string }) => Promise<void>;
  deleteAgent: (name: string) => Promise<void>;
  sendMessage: (agentId: string, message: string) => Promise<void>;
  createSession: (agentId: string, label?: string) => Promise<{ key: string; sessionId: string }>;
  openChat: (agentId: string) => void;
  closeChat: () => void;
}

export const useOpenClawStore = create<OpenClawStore>((set, get) => ({
  connectionStatus: 'disconnected',
  agents: [],
  sessions: [],
  activeChat: null,

  connect: async () => {
    set({ connectionStatus: 'connecting' });
    try {
      const res = await openclawApi.getStatus();
      set({ connectionStatus: res.data.running ? 'connected' : 'disconnected' });
      if (res.data.running) {
        await Promise.all([get().fetchAgents(), get().fetchSessions()]);
      }
    } catch {
      set({ connectionStatus: 'disconnected' });
    }
  },

  fetchAgents: async () => {
    try {
      const res = await openclawApi.listAgents();
      set({ agents: res.data });
    } catch { /* silent */ }
  },

  fetchSessions: async () => {
    try {
      const res = await openclawApi.listSessions();
      set({ sessions: res.data });
    } catch { /* silent */ }
  },

  createAgent: async (config) => {
    await openclawApi.createAgent(config);
    await get().fetchAgents();
  },

  deleteAgent: async (name) => {
    await openclawApi.deleteAgent(name);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== name && a.name !== name) }));
  },

  sendMessage: async (agentId, message) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      activeChat: s.activeChat
        ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg] }
        : { agentId, messages: [userMsg] },
    }));
    try {
      const res = await openclawApi.sendMessage(agentId, message);
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: res.data.response,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? { ...s.activeChat, messages: [...s.activeChat.messages, agentMsg] }
          : null,
      }));
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        activeChat: s.activeChat
          ? { ...s.activeChat, messages: [...s.activeChat.messages, errMsg] }
          : null,
      }));
    }
  },

  createSession: async (agentId, label) => {
    const res = await openclawApi.createSession(agentId, label);
    await get().fetchSessions();
    return res.data;
  },

  openChat: (agentId) => set({ activeChat: { agentId, messages: [] } }),
  closeChat: () => set({ activeChat: null }),
}));
