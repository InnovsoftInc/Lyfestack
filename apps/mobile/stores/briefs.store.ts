import { create } from 'zustand';
import type { DailyBrief } from '@lyfestack/shared';
import { briefsApi } from '../services/api';

interface BriefsState {
  brief: DailyBrief | null;
  streak: number;
  completionRate: number;
  isLoading: boolean;
  error: string | null;
  fetchToday: () => Promise<void>;
  completeTask: (briefId: string, taskId: string) => Promise<void>;
}

export const useBriefsStore = create<BriefsState>((set) => ({
  brief: null,
  streak: 0,
  completionRate: 0,
  isLoading: false,
  error: null,

  fetchToday: async () => {
    set({ isLoading: true, error: null });
    try {
      const brief = await briefsApi.getToday();
      set({ brief, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load brief' });
    }
  },

  completeTask: async (briefId, taskId) => {
    try {
      const updated = await briefsApi.completeTask(briefId, taskId);
      set({ brief: updated });
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to complete task' });
    }
  },
}));
