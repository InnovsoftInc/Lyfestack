import { create } from 'zustand';
import * as briefsApi from '../services/briefs.api';
import type { DailyBrief } from '../services/briefs.api';

interface BriefState {
  brief: DailyBrief | null;
  isLoading: boolean;
  error: string | null;

  fetchTodayBrief: () => Promise<void>;
  completeTask: (briefId: string, taskId: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

export const useBriefStore = create<BriefState>((set, get) => ({
  brief: null,
  isLoading: false,
  error: null,

  fetchTodayBrief: async () => {
    set({ isLoading: true, error: null });
    try {
      const brief = await briefsApi.getTodayBrief();
      set({ brief, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load daily brief';
      set({ error: message, isLoading: false });
    }
  },

  completeTask: async (briefId, taskId) => {
    try {
      const updatedBrief = await briefsApi.markTaskComplete(briefId, taskId);
      set({ brief: updatedBrief });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete task';
      set({ error: message });
    }
  },

  approveTask: async (taskId) => {
    try {
      const task = await briefsApi.approveTask(taskId);
      const { brief } = get();
      if (brief) {
        const tasks = brief.tasks.map((t) => (t.id === taskId ? { ...t, ...task } : t));
        set({ brief: { ...brief, tasks } });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve task';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
