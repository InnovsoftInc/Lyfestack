import { create } from 'zustand';
import type { AgentAction } from '@lyfestack/shared';
import { ApprovalState } from '@lyfestack/shared';
import { mockAgentActions } from '../utils/mockData';

interface ApprovalsState {
  actions: AgentAction[];
  approve: (id: string) => void;
  reject: (id: string) => void;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  actions: mockAgentActions,
  approve: (id) =>
    set({
      actions: get().actions.map((a) =>
        a.id === id
          ? { ...a, approvalState: ApprovalState.APPROVED, resolvedAt: new Date().toISOString() }
          : a
      ),
    }),
  reject: (id) =>
    set({
      actions: get().actions.map((a) =>
        a.id === id
          ? { ...a, approvalState: ApprovalState.REJECTED, resolvedAt: new Date().toISOString() }
          : a
      ),
    }),
}));
