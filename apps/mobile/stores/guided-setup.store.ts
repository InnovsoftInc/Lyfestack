import { create } from 'zustand';
import {
  startSession as apiStartSession,
  submitAnswer as apiSubmitAnswer,
} from '../services/guided-setup.api';
import type { GuidedQuestion, GeneratedPlan, SSEEvent } from '../services/guided-setup.api';

export interface QAPair {
  step: number;
  question: string;
  value: string;
}

export interface GenerationMessage {
  id: string;
  type: 'thinking' | 'progress' | 'complete' | 'error';
  message: string;
}

interface GuidedSetupState {
  sessionId: string | null;
  currentQuestion: GuidedQuestion | null;
  answers: QAPair[];
  questionHistory: GuidedQuestion[];
  isLoading: boolean;
  isGenerating: boolean;
  generationMessages: GenerationMessage[];
  generatedPlan: GeneratedPlan | null;
  error: string | null;

  startSession: (templateId: string) => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  goBack: () => void;
  addGenerationMessage: (event: SSEEvent) => void;
  setGeneratedPlan: (plan: GeneratedPlan) => void;
  setIsGenerating: (v: boolean) => void;
  reset: () => void;
  clearError: () => void;
}

export const useGuidedSetupStore = create<GuidedSetupState>((set, get) => ({
  sessionId: null,
  currentQuestion: null,
  answers: [],
  questionHistory: [],
  isLoading: false,
  isGenerating: false,
  generationMessages: [],
  generatedPlan: null,
  error: null,

  startSession: async (templateId) => {
    set({ isLoading: true, error: null });
    try {
      const question = await apiStartSession(templateId);
      set({
        sessionId: question.sessionId,
        currentQuestion: question,
        questionHistory: [question],
        answers: [],
        generationMessages: [],
        generatedPlan: null,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  submitAnswer: async (answer) => {
    const { sessionId, currentQuestion, answers, questionHistory } = get();
    if (!sessionId || !currentQuestion) return;

    set({ isLoading: true, error: null });
    try {
      const nextQuestion = await apiSubmitAnswer(sessionId, answer);
      const newAnswer: QAPair = {
        step: currentQuestion.step,
        question: currentQuestion.question,
        value: answer,
      };
      set({
        currentQuestion: nextQuestion,
        answers: [...answers, newAnswer],
        questionHistory: [...questionHistory, nextQuestion],
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  goBack: () => {
    const { questionHistory, answers } = get();
    if (questionHistory.length <= 1) return;
    const prevHistory = questionHistory.slice(0, -1);
    set({
      currentQuestion: prevHistory[prevHistory.length - 1],
      questionHistory: prevHistory,
      answers: answers.slice(0, -1),
    });
  },

  addGenerationMessage: (event) => {
    const msg: GenerationMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type: event.type as GenerationMessage['type'],
      message: event.message ?? '',
    };
    set((s) => ({ generationMessages: [...s.generationMessages, msg] }));
  },

  setGeneratedPlan: (plan) => set({ generatedPlan: plan }),

  setIsGenerating: (v) => set({ isGenerating: v }),

  reset: () =>
    set({
      sessionId: null,
      currentQuestion: null,
      answers: [],
      questionHistory: [],
      isLoading: false,
      isGenerating: false,
      generationMessages: [],
      generatedPlan: null,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));
