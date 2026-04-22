import { create } from 'zustand';
import type { Goal } from '@lyfestack/shared';
import { createGoal as apiCreateGoal, generatePlan as apiGeneratePlan, getGoals as apiGetGoals } from '../services/goals.api';
import type { CreateGoalPayload, DiagnosticAnswer, Plan } from '../services/goals.api';

interface GoalsState {
  goals: Goal[];
  selectedGoal: Goal | null;
  isLoading: boolean;
  error: string | null;
  setSelectedGoal: (goal: Goal | null) => void;
  setGoals: (goals: Goal[]) => void;
  clearError: () => void;
  fetchGoals: () => Promise<void>;
  createGoal: (payload: CreateGoalPayload) => Promise<{ id: string }>;
  generatePlan: (goalId: string, templateId: string, answers: DiagnosticAnswer[], userId: string) => Promise<Plan>;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  selectedGoal: null,
  isLoading: false,
  error: null,

  setSelectedGoal: (goal) => set({ selectedGoal: goal }),
  setGoals: (goals) => set({ goals }),
  clearError: () => set({ error: null }),

  fetchGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await apiGetGoals();
      set({ isLoading: false, goals: goals as unknown as Goal[] });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to fetch goals' });
    }
  },

  createGoal: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const goal = await apiCreateGoal(payload);
      set((s) => ({ isLoading: false, goals: [...s.goals, goal as unknown as Goal] }));
      return goal;
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to create goal' });
      throw err;
    }
  },

  generatePlan: async (goalId, templateId, answers, userId) => {
    set({ isLoading: true, error: null });
    try {
      const plan = await apiGeneratePlan(goalId, templateId, answers, userId);
      set({ isLoading: false });
      return plan;
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to generate plan' });
      throw err;
    }
  },
}));
