import { create } from 'zustand';
import type { Goal } from '@lyfestack/shared';
import { mockGoals } from '../utils/mockData';

interface GoalsState {
  goals: Goal[];
  selectedGoal: Goal | null;
  setSelectedGoal: (goal: Goal | null) => void;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: mockGoals,
  selectedGoal: null,
  setSelectedGoal: (goal) => set({ selectedGoal: goal }),
}));
