import { create } from 'zustand';

interface OnboardingState {
  selectedTemplateId: string | null;
  diagnosticAnswers: Record<string, string>;
  setTemplate: (id: string) => void;
  setAnswer: (questionId: string, answer: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  selectedTemplateId: null,
  diagnosticAnswers: {},
  setTemplate: (id) => set({ selectedTemplateId: id }),
  setAnswer: (questionId, answer) =>
    set((state) => ({
      diagnosticAnswers: { ...state.diagnosticAnswers, [questionId]: answer },
    })),
  reset: () => set({ selectedTemplateId: null, diagnosticAnswers: {} }),
}));
