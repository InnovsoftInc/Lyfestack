import { create } from 'zustand';

export interface GeneratedMilestone {
  title: string;
  dueDayOffset: number;
}

export interface GeneratedTask {
  title: string;
  description: string;
  type: string;
  durationMinutes: number;
  dayOffset: number;
}

export interface GeneratedPlan {
  title: string;
  description: string;
  estimatedDurationDays: number;
  milestones: GeneratedMilestone[];
  tasks: GeneratedTask[];
}

interface OnboardingState {
  selectedTemplateId: string | null;
  diagnosticAnswers: Record<string, string>;
  generatedPlan: GeneratedPlan | null;
  setTemplate: (id: string) => void;
  setAnswer: (questionId: string, answer: string) => void;
  setGeneratedPlan: (plan: GeneratedPlan | null) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  selectedTemplateId: null,
  diagnosticAnswers: {},
  generatedPlan: null,
  setTemplate: (id) => set({ selectedTemplateId: id }),
  setAnswer: (questionId, answer) =>
    set((state) => ({
      diagnosticAnswers: { ...state.diagnosticAnswers, [questionId]: answer },
    })),
  setGeneratedPlan: (plan) => set({ generatedPlan: plan }),
  reset: () => set({ selectedTemplateId: null, diagnosticAnswers: {}, generatedPlan: null }),
}));
