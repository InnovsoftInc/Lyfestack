import { create } from 'zustand';
import { openclawApi } from '../services/openclaw.api';

interface Agent {
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  status: 'active' | 'idle' | 'offline';
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
  activeChat: { agentName: string; messages: ChatMessage[] } | null;
  connect: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  createAgent: (config: { name: string; role: string; model: string; systemPrompt: string }) => Promise<void>;
  deleteAgent: (name: string) => Promise<void>;
  sendMessage: (agentName: string, message: string) => Promise<void>;
  openChat: (agentName: string) => void;
  closeChat: () => void;
}

export const useOpenClawStore = create<OpenClawStore>((set, get) => ({
  connectionStatus: 'disconnected',
  agents: [],
  activeChat: null,

  connect: async () => {
    set({ connectionStatus: 'connecting' });
    try {
      const res = await openclawApi.getStatus();
      set({ connectionStatus: res.data.running ? 'connected' : 'disconnected' });
      if (res.data.running) await get().fetchAgents();
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

  createAgent: async (config) => {
    await openclawApi.createAgent(config);
    await get().fetchAgents();
  },

  deleteAgent: async (name) => {
    await openclawApi.deleteAgent(name);
    set((s) => ({ agents: s.agents.filter((a) => a.name !== name) }));
  },

  sendMessage: async (agentName, message) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: message, timestamp: new Date().toISOString() };
    set((s) => ({
      activeChat: s.activeChat ? { ...s.activeChat, messages: [...s.activeChat.messages, userMsg] } : { agentName, messages: [userMsg] },
    }));
    try {
      const res = await openclawApi.sendMessage(agentName, message);
      const agentMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'agent', content: res.data.response, timestamp: new Date().toISOString() };
      set((s) => ({
        activeChat: s.activeChat ? { ...s.activeChat, messages: [...s.activeChat.messages, agentMsg] } : null,
      }));
    } catch (err: any) {
      const errMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'agent', content: `Error: ${err.message}`, timestamp: new Date().toISOString() };
      set((s) => ({
        activeChat: s.activeChat ? { ...s.activeChat, messages: [...s.activeChat.messages, errMsg] } : null,
      }));
    }
  },

  openChat: (agentName) => set({ activeChat: { agentName, messages: [] } }),
  closeChat: () => set({ activeChat: null }),
}));
