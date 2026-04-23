import { create } from 'zustand';
import { openclawApi } from '../services/openclaw.api';

export interface Routine {
  id: string;
  name: string;
  description: string;
  type: 'heartbeat' | 'hook' | 'cron' | 'custom';
  schedule: string;
  trigger?: string;
  agent?: string;
  agentName?: string;
  prompt?: string;
  model?: string;
  channel?: string;
  enabled: boolean;
  source: 'openclaw' | 'lyfestack';
  lastRun?: string;
  lastRunStatus?: 'success' | 'error' | 'running';
  config?: Record<string, unknown>;
}

export type Automation = Routine;

interface AutomationsStore {
  automations: Routine[];
  isLoading: boolean;
  runningIds: string[];
  error: string | null;
  fetch: () => Promise<void>;
  create: (data: {
    name: string;
    schedule: string;
    agent: string;
    prompt: string;
    enabled?: boolean;
    notify?: { channel: string };
  }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  runNow: (id: string) => Promise<{ status: 'success' | 'error'; result?: string; error?: string }>;
}

export const useAutomationsStore = create<AutomationsStore>((set, get) => ({
  automations: [],
  isLoading: false,
  runningIds: [],
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await openclawApi.listAutomations();
      set({ automations: res.data ?? [], isLoading: false });
    } catch (err: unknown) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load routines' });
    }
  },

  create: async (data) => {
    const res = await openclawApi.createAutomation(data);
    set((s) => ({ automations: [...s.automations, res.data] }));
  },

  remove: async (id) => {
    await openclawApi.deleteAutomation(id);
    set((s) => ({ automations: s.automations.filter((a) => a.id !== id) }));
  },

  toggle: async (id, enabled) => {
    const res = await openclawApi.toggleAutomation(id, enabled);
    set((s) => ({
      automations: s.automations.map((a) => (a.id === id ? res.data : a)),
    }));
  },

  runNow: async (id) => {
    set((s) => ({ runningIds: [...s.runningIds, id] }));
    try {
      const res = await openclawApi.runAutomationNow(id);
      await get().fetch();
      return { status: res.data?.status ?? 'error', result: res.data?.result, error: res.data?.error };
    } finally {
      set((s) => ({ runningIds: s.runningIds.filter((rid) => rid !== id) }));
    }
  },
}));
