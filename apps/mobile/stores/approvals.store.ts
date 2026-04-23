import { create } from 'zustand';
import {
  getAgentActions,
  approveAction as apiApproveAction,
  rejectAction as apiRejectAction,
} from '../services/agents.api';
import type { AgentAction } from '../services/agents.api';

interface ApprovalsState {
  actions: AgentAction[];
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  actions: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const actions = await getAgentActions();
      set({ actions, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load approvals';
      set({ isLoading: false, error: message });
    }
  },

  approve: async (id) => {
    try {
      const updated = await apiApproveAction(id);
      set({ actions: get().actions.map((a) => (a.id === id ? updated : a)) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve action';
      set({ error: message });
    }
  },

  reject: async (id) => {
    try {
      const updated = await apiRejectAction(id);
      set({ actions: get().actions.map((a) => (a.id === id ? updated : a)) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject action';
      set({ error: message });
    }
  },
}));
