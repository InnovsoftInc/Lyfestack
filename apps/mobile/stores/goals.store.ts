import { create } from 'zustand';
import * as goalsApi from '../services/goals.api';
import type { Goal, CreateGoalPayload, Plan, DiagnosticAnswer } from '../services/goals.api';

interface GoalsState {
  goals: Goal[];
  selectedGoal: Goal | null;
  currentPlan: Plan | null;
  isLoading: boolean;
  error: string | null;

  fetchGoals: () => Promise<void>;
  fetchGoal: (id: string) => Promise<void>;
  createGoal: (payload: CreateGoalPayload) => Promise<Goal>;
  generatePlan: (goalId: string, templateId: string, answers: DiagnosticAnswer[], userId: string) => Promise<Plan>;
  clearError: () => void;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  selectedGoal: null,
  currentPlan: null,
  isLoading: false,
  error: null,

  fetchGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await goalsApi.getGoals();
      set({ goals, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load goals';
      set({ error: message, isLoading: false });
    }
  },

  fetchGoal: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const goal = await goalsApi.getGoal(id);
      set({ selectedGoal: goal, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load goal';
      set({ error: message, isLoading: false });
    }
  },

  createGoal: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const goal = await goalsApi.createGoal(payload);
      set((state) => ({ goals: [goal, ...state.goals], isLoading: false }));
      return goal;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create goal';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  generatePlan: async (goalId, templateId, answers, userId) => {
    set({ isLoading: true, error: null });
    try {
      const plan = await goalsApi.generatePlan(goalId, templateId, answers, userId);
      set({ currentPlan: plan, isLoading: false });
      return plan;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate plan';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
