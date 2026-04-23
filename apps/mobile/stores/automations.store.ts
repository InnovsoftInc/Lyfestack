import { create } from 'zustand';
import { openclawApi } from '../services/openclaw.api';

export interface Automation {
  id: string;
  name: string;
  agentName: string;
  cronExpression: string;
  scheduleLabel: string;
  message: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
}

interface AutomationsStore {
  automations: Automation[];
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (data: Omit<Automation, 'id' | 'createdAt' | 'lastRunAt' | 'nextRunAt' | 'lastResult'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  runNow: (id: string) => Promise<void>;
}

export const useAutomationsStore = create<AutomationsStore>((set, get) => ({
  automations: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await openclawApi.listAutomations();
      set({ automations: res.data ?? [], isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Failed to load automations' });
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
    await openclawApi.runAutomationNow(id);
    await get().fetch();
  },
}));
