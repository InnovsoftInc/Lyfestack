import { create } from 'zustand';
import type { Goal } from '@lyfestack/shared';

interface GoalsState {
  goals: Goal[];
  selectedGoal: Goal | null;
  isLoading: boolean;
  error: string | null;
  setSelectedGoal: (goal: Goal | null) => void;
  setGoals: (goals: Goal[]) => void;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  selectedGoal: null,
  isLoading: false,
  error: null,
  setSelectedGoal: (goal) => set({ selectedGoal: goal }),
  setGoals: (goals) => set({ goals }),
}));
